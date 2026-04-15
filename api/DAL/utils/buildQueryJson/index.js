import crypto from 'node:crypto';
import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';

const SEMANTIC_MIN_SCORE = 0;
const DEFAULT_SEMANTIC_K = 50;
const VARIANT_THRESHOLD = 50;
const SHOULD_THRESHOLD = 50;
const DEFAULT_LEXICAL_BOOST = 12;
const DEFAULT_DATE_BOOST = 1;
const DEFAULT_NEURAL_BOOST = 4;

// the highlighting features need to use the same query as the search (see bug:CICADS-655),
// use this intent to set the scope of the query single page or all matching pages
const QUERY_INTENTS = Object.freeze({
    SEARCH_RESULTS: 'searchResults',
    PAGE_CHUNK_MATCHES: 'pageChunkMatches'
});

/**
 * Determines whether pagination fields should be emitted.
 *
 * @param {'searchResults' | 'pageChunkMatches'} queryIntent - Query purpose.
 * @returns {boolean}
 */
function shouldApplyPagination(queryIntent) {
    return queryIntent === QUERY_INTENTS.SEARCH_RESULTS;
}

/**
 * Creates the lexical query shell scoped to the case reference.
 *
 * @param {string} caseReferenceNumber - Case reference filter value.
 * @returns {Object}
 */
function createLexicalQuery(caseReferenceNumber) {
    return {
        bool: {
            must: [{ term: { case_ref: caseReferenceNumber } }]
        }
    };
}

/**
 * Creates the semantic neural query (scoped to the case reference).
 *
 * @param {Object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {Object}
 */
function createNeuralQuery({ keyword, caseReferenceNumber }) {
    return {
        neural: {
            embedding: {
                query_text: keyword,
                k: DEFAULT_SEMANTIC_K,
                filter: {
                    term: { case_ref: caseReferenceNumber }
                }
            }
        }
    };
}

/**
 * Builds lexical should clauses and date-processing metrics.
 *
 * @param {Object} params - Date processing options.
 * @param {string} params.keyword - Raw search string.
 * @param {boolean} [params.enableDateExtraction=true] - Whether to extract and expand dates.
 * @returns {Object}
 */
function buildDateAwareShouldClauses({ keyword, enableDateExtraction = true }) {
    const extractStart = Date.now();

    let phrases = [];
    let remainingText = keyword;
    let matchedPatterns = [];

    if (enableDateExtraction) {
        const extractionResult = extractDatesFromSearchString(keyword);
        phrases = extractionResult.dates;
        remainingText = extractionResult.remainingText;
        matchedPatterns = extractionResult.matchedPatterns;
    }

    const extractEnd = Date.now();

    const variantStart = Date.now();
    let phrasesVariants = [];

    if (enableDateExtraction) {
        // Build variants for each extracted phrase, falling back to the
        // original phrase if no variants are produced, and then
        // deduplicate (via the Set) across all phrases.
        phrasesVariants = Array.from(
            new Set(
                phrases.flatMap((phrase, index) => {
                    const variants = generateDateFormatVariants(phrase, matchedPatterns[index]);
                    if (!variants || variants.length === 0) {
                        return [phrase];
                    }
                    return variants;
                })
            )
        );
    }

    const variantEnd = Date.now();

    const shouldClauses = [];

    if (phrasesVariants.length > 0) {
        phrasesVariants.forEach((phrase) => {
            shouldClauses.push({
                match_phrase: {
                    chunk_text: phrase
                }
            });
        });
    }

    if (remainingText) {
        shouldClauses.push({
            match: {
                chunk_text: {
                    query: remainingText
                }
            }
        });
    }

    return {
        shouldClauses,
        phrases,
        phrasesVariants,
        extractStart,
        extractEnd,
        variantStart,
        variantEnd
    };
}

/**
 * Computes and logs query metrics with threshold warnings.
 *
 * @param {Object} params - Logging inputs.
 * @param {Object} params.queryJson - Final query payload.
 * @param {string} params.keyword - Raw search string.
 * @param {Array<string>} params.phrases - Extracted date phrases.
 * @param {Array<string>} params.phrasesVariants - Expanded phrase variants.
 * @param {Array<Object>} params.shouldClauses - Generated lexical clauses.
 * @param {number} params.startBuild - Build start timestamp.
 * @param {number} params.buildEnd - Build end timestamp.
 * @param {number} params.extractStart - Extraction start timestamp.
 * @param {number} params.extractEnd - Extraction end timestamp.
 * @param {number} params.variantStart - Variant generation start timestamp.
 * @param {number} params.variantEnd - Variant generation end timestamp.
 * @param {Logger} [params.logger] - Optional structured logger.
 * @param {string} params.caseReferenceNumber - Case reference scope for logs.
 * @returns {void}
 */
function logQueryMetrics({
    queryJson,
    keyword,
    phrases,
    phrasesVariants,
    shouldClauses,
    startBuild,
    buildEnd,
    extractStart,
    extractEnd,
    variantStart,
    variantEnd,
    logger,
    caseReferenceNumber
}) {
    const metrics = {
        queryHash: crypto.createHash('sha256').update(keyword).digest('hex').slice(0, 8),
        phraseCount: phrases.length,
        variantCount: phrasesVariants.length,
        shouldClauseCount: shouldClauses.length,
        payloadSize: JSON.stringify(queryJson).length,
        extractMs: extractEnd - extractStart,
        variantMs: variantEnd - variantStart,
        buildMs: buildEnd - startBuild
    };

    if (!logger) {
        return;
    }

    logger.info(
        {
            caseReferenceNumber,
            ...metrics
        },
        '[QueryBuilder] Query metrics'
    );

    if (metrics.variantCount > VARIANT_THRESHOLD || metrics.shouldClauseCount > SHOULD_THRESHOLD) {
        logger.warn(
            {
                caseReferenceNumber,
                queryHash: metrics.queryHash,
                variantCount: metrics.variantCount,
                shouldClauseCount: metrics.shouldClauseCount
            },
            '[QueryBuilder] Variant/clause count exceeds safe threshold'
        );
    }
}

/**
 * Builds an OpenSearch  query JSON object based on the provided search parameters.
 *
 * The query:
 * - Filters by an exact `case_ref` using a `term` query.
 * - Extracts date phrases from the keyword and adds them as `match_phrase` queries.
 * - Adds remaining keyword text as a `match` query against `chunk_text`.
 * - Applies pagination using `from` and `size`.
 *
 * @param {Object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 * @param {Logger} [params.logger] - Optional structured logger instance.
 * @param {'keyword' | 'semantic' | 'hybrid'} [params.searchType='keyword'] - Which search mode to use.
 * @param {'searchResults' | 'pageChunkMatches'} [params.queryIntent='searchResults'] - Query purpose.
 * @param {boolean} [params.enableDateExtraction=true] - Enables date extraction and variant matching.
 * @param {number} [params.keywordBoost] - Boost multiplier for the lexical sub-query in hybrid mode.
 * @param {number} [params.dateBoost] - Boost multiplier for date variant clauses in hybrid mode.
 * @param {number} [params.semanticBoost] - Boost multiplier for the neural sub-query in hybrid mode.
 *
 * @returns {Object} OpenSearch query DSL JSON object.
 */
function buildQueryJson({
    keyword,
    caseReferenceNumber,
    pageNumber,
    itemsPerPage,
    logger,
    searchType = 'keyword',
    queryIntent = QUERY_INTENTS.SEARCH_RESULTS,
    enableDateExtraction = true,
    keywordBoost = DEFAULT_LEXICAL_BOOST,
    dateBoost = DEFAULT_DATE_BOOST,
    semanticBoost = DEFAULT_NEURAL_BOOST
}) {
    const startBuild = Date.now();
    const queryJson = {};
    const applyPagination = shouldApplyPagination(queryIntent);
    const normalizedPageNumber = Number.parseInt(pageNumber, 10);
    const normalizedItemsPerPage = Number.parseInt(itemsPerPage, 10);
    const safePageNumber =
        Number.isFinite(normalizedPageNumber) && normalizedPageNumber > 0
            ? normalizedPageNumber
            : 1;
    const safeItemsPerPage =
        Number.isFinite(normalizedItemsPerPage) && normalizedItemsPerPage > 0
            ? normalizedItemsPerPage
            : 10;

    if (applyPagination) {
        queryJson.from = safeItemsPerPage * (safePageNumber - 1);
        queryJson.size = safeItemsPerPage;
    }

    const lexicalQuery = createLexicalQuery(caseReferenceNumber);

    const {
        shouldClauses,
        phrases,
        phrasesVariants,
        extractStart,
        extractEnd,
        variantStart,
        variantEnd
    } = buildDateAwareShouldClauses({ keyword, enableDateExtraction });

    if (shouldClauses.length > 0) {
        lexicalQuery.bool.should = shouldClauses;
        lexicalQuery.bool.minimum_should_match = 1;
    }

    const hasKeyword = keyword.trim().length > 0;
    const runKeywordSearch = searchType === 'keyword' || searchType === 'hybrid';
    const runSemanticSearch = (searchType === 'semantic' || searchType === 'hybrid') && hasKeyword;

    if (runSemanticSearch) {
        queryJson.min_score = SEMANTIC_MIN_SCORE;
    }

    const neuralQuery = createNeuralQuery({
        keyword,
        caseReferenceNumber
    });

    // If both searches are enabled, build top-level hybrid with one lexical branch
    // and one semantic branch.
    if (runKeywordSearch && runSemanticSearch) {
        const lexicalBranchMustClauses = [{ term: { case_ref: caseReferenceNumber } }];
        const dateShouldClauses = shouldClauses.filter((clause) =>
            Object.hasOwn(clause, 'match_phrase')
        );
        const keywordMatchClause = shouldClauses.find((clause) => Object.hasOwn(clause, 'match'));

        if (dateShouldClauses.length > 0) {
            lexicalBranchMustClauses.push({
                bool: {
                    should: dateShouldClauses,
                    minimum_should_match: 1,
                    boost: dateBoost
                }
            });
        }

        if (keywordMatchClause?.match?.chunk_text) {
            lexicalBranchMustClauses.push({
                match: {
                    chunk_text: {
                        ...keywordMatchClause.match.chunk_text,
                        boost: keywordBoost
                    }
                }
            });
        }

        const hybridQuery = {
            queries: [
                {
                    bool: {
                        must: lexicalBranchMustClauses
                    }
                },
                {
                    bool: {
                        must: [
                            {
                                neural: {
                                    embedding: {
                                        query_text: keyword,
                                        k: DEFAULT_SEMANTIC_K,
                                        boost: semanticBoost
                                    }
                                }
                            }
                        ]
                    }
                }
            ]
        };

        if (applyPagination) {
            hybridQuery.pagination_depth = DEFAULT_SEMANTIC_K; // queryJson.from + queryJson.size;
        }

        queryJson.query = {
            hybrid: hybridQuery
        };
    } else if (runSemanticSearch) {
        // just a semantic search
        queryJson.query = neuralQuery;
    } else {
        // just a keyword search
        queryJson.query = lexicalQuery;
    }

    const buildEnd = Date.now();
    logQueryMetrics({
        queryJson,
        keyword,
        phrases,
        phrasesVariants,
        shouldClauses,
        startBuild,
        buildEnd,
        extractStart,
        extractEnd,
        variantStart,
        variantEnd,
        logger,
        caseReferenceNumber
    });

    console.log(JSON.stringify(queryJson, null, 2));
    return queryJson;
}

export default buildQueryJson;
