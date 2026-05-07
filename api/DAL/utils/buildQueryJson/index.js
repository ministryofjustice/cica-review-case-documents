import crypto from 'node:crypto';
import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';

const SEMANTIC_MIN_SCORE = 0.1; // Needs to be worked out through experimentation or dropped in favour of a low K value
const DEFAULT_SEMANTIC_K = 5; // Too high and we get a lot of poor quality results - noise
const VARIANT_THRESHOLD = 50; // date variant count above which we log a warning, as this could indicate an explosion in the number of should clauses and potential performance issues
const SHOULD_THRESHOLD = 50; // should clause count above which we log a warning, as this could indicate an explosion in the number of should clauses and potential performance issues
const DEFAULT_LEXICAL_BOOST = 12; // lexical search results to appear most relevant
const DEFAULT_DATE_BOOST = 1; // weightings to be determined
const DEFAULT_NEURAL_BOOST = 4; // weightings to be determined

/**
 * Creates the lexical query shell scoped to the case reference.
 *
 * @param {string} caseReferenceNumber - Case reference filter value.
 * @returns {object} Lexical query DSL object.
 */
function createLexicalQuery({ caseReferenceNumber }) {
    return {
        query: {
            bool: {
                must: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        }
    };
}

/**
 * Creates the semantic neural query (scoped to the case reference).
 *
 * @param {object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Semantic query DSL object.
 */
function createNeuralQuery({ keyword, caseReferenceNumber }) {
    return {
        query: {
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    filter: {
                        bool: {
                            must: [{ term: { case_ref: caseReferenceNumber } }]
                        }
                    }
                }
            }
        },
        min_score: keyword.trim().length > 0 ? SEMANTIC_MIN_SCORE : undefined
    };
}

/**
 * Creates the hybrid query shell scoped to the case reference.
 *
 * @param {string} caseReferenceNumber - Case reference filter value.
 * @returns {object} Hybrid query DSL object.
 */
function createHybridQuery({ caseReferenceNumber }) {
    return {
        query: {
            bool: {
                must: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        },
        min_score: SEMANTIC_MIN_SCORE
    };
}

/**
 * Builds lexical should clauses and date-processing metrics.
 *
 * @param {object} params - Date processing options.
 * @param {string} params.keyword - Raw search string.
 * @param {boolean} [params.enableDateExtraction=true] - Whether to extract and expand dates.
 * @returns {{ shouldClauses: Array<object>, phrases: Array<string>, phrasesVariants: Array<string>, timings: { extractMs: number, variantMs: number } }} Lexical clauses and date-processing metrics.
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
        timings: {
            extractMs: extractEnd - extractStart,
            variantMs: variantEnd - variantStart
        }
    };
}

/**
 * Normalises raw pageNumber and itemsPerPage inputs to safe integer values.
 *
 * @param {number} pageNumber - Raw page number (1-based).
 * @param {number} itemsPerPage - Raw items-per-page value.
 * @returns {{ safePageNumber: number, safeItemsPerPage: number }} Normalised pagination values.
 */
function normalisePagination(pageNumber, itemsPerPage) {
    const normalizedPageNumber = Number.parseInt(pageNumber, 10);
    const normalizedItemsPerPage = Number.parseInt(itemsPerPage, 10);
    return {
        safePageNumber:
            Number.isFinite(normalizedPageNumber) && normalizedPageNumber > 0
                ? normalizedPageNumber
                : 1,
        safeItemsPerPage:
            Number.isFinite(normalizedItemsPerPage) && normalizedItemsPerPage > 0
                ? normalizedItemsPerPage
                : 10
    };
}

/**
 * Assembles the keyword (lexical) query, applying should clauses and optional document scoping.
 *
 * @param {object} params - Keyword query options.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {Array<object>} params.shouldClauses - Lexical should clauses from date/text extraction.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @returns {object} Assembled keyword query DSL object.
 */
function buildKeywordQuery({ caseReferenceNumber, shouldClauses, safePageNumber, documentId }) {
    const queryJson = createLexicalQuery(caseReferenceNumber);

    queryJson.query.bool.should = shouldClauses;
    queryJson.query.bool.minimum_should_match = shouldClauses.length > 0 ? 1 : undefined;

    if (documentId) {
        queryJson.query.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    return queryJson;
}

/**
 * Assembles the semantic (neural) query, applying optional document scoping and simplifying
 * the filter DSL where possible.
 *
 * @param {object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @returns {object} Assembled semantic query DSL object.
 */
function buildSemanticQuery({ keyword, caseReferenceNumber, safePageNumber, documentId }) {
    const queryJson = createNeuralQuery({ keyword, caseReferenceNumber });

    if (documentId) {
        queryJson.query.neural.embedding.filter.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    // When there is only a single filter must clause and the keyword is non-empty,
    // simplify the DSL by unwrapping the bool wrapper.
    if (
        queryJson.query.neural.embedding.filter.bool.must.length === 1 &&
        keyword.trim().length !== 0
    ) {
        queryJson.query.neural.embedding.filter =
            queryJson.query.neural.embedding.filter.bool.must[0];
    }

    // An empty keyword means the neural clause has no query text and would match
    // everything. Promote the filter to the top-level query and drop the neural
    // clause and min_score so the query correctly scopes to case_ref only.
    if (keyword.trim().length === 0) {
        queryJson.query = queryJson.query.neural.embedding.filter;
        delete queryJson.query.neural;
        delete queryJson.min_score;
    }

    return queryJson;
}

/**
 * Assembles the hybrid (bool + neural) query, combining boosted lexical, date, and neural
 * should clauses with optional document scoping.
 *
 * @param {object} params - Hybrid query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {Array<object>} params.shouldClauses - Lexical should clauses from date/text extraction.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @param {number} params.keywordBoost - Boost for the lexical match clause.
 * @param {number} params.dateBoost - Boost for the grouped date variant clauses.
 * @param {number} params.semanticBoost - Boost for the neural clause.
 * @returns {object} Assembled hybrid query DSL object.
 */
function buildHybridQuery({
    keyword,
    caseReferenceNumber,
    shouldClauses,
    safePageNumber,
    documentId,
    keywordBoost,
    dateBoost,
    semanticBoost
}) {
    const queryJson = createHybridQuery(caseReferenceNumber);

    const matchClause = shouldClauses.find((clause) => Object.hasOwn(clause, 'match'));
    const matchPhraseClauses = shouldClauses.filter((clause) =>
        Object.hasOwn(clause, 'match_phrase')
    );

    if (documentId) {
        queryJson.query.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    // Boosted lexical match clause.
    if (matchClause?.match?.chunk_text) {
        queryJson.query.bool.should.push({
            match: {
                chunk_text: {
                    ...matchClause.match.chunk_text,
                    boost: keywordBoost
                }
            }
        });
    }

    // Boosted date variant clauses, grouped so they share a single boost weight.
    if (matchPhraseClauses.length > 0) {
        queryJson.query.bool.should.push({
            bool: {
                should: matchPhraseClauses,
                minimum_should_match: 1,
                boost: dateBoost
            }
        });
    }

    // Boosted neural clause — only when the keyword is non-empty.
    if (keyword.trim().length > 0) {
        queryJson.query.bool.should.push({
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    boost: semanticBoost
                }
            }
        });
    }

    return queryJson;
}

/**
 * Computes and logs query metrics with threshold warnings.
 *
 * @param {object} params - Logging inputs.
 * @param {object} params.queryJson - Final query payload.
 * @param {string} params.keyword - Raw search string.
 * @param {Array<string>} params.phrases - Extracted date phrases.
 * @param {Array<string>} params.phrasesVariants - Expanded phrase variants.
 * @param {Array<object>} params.shouldClauses - Generated lexical clauses.
 * @param {number} params.buildMs - Build duration in ms.
 * @param {number} params.extractMs - Extraction duration in ms.
 * @param {number} params.variantMs - Variant generation duration in ms.
 * @param {object} [params.logger] - Optional structured logger.
 * @param {string} params.caseReferenceNumber - Case reference scope for logs.
 * @returns {void}
 */
function logQueryMetrics({
    queryJson,
    keyword,
    phrases,
    phrasesVariants,
    shouldClauses,
    buildMs,
    extractMs,
    variantMs,
    logger,
    caseReferenceNumber
}) {
    const metrics = {
        queryHash: crypto.createHash('sha256').update(keyword).digest('hex').slice(0, 8),
        phraseCount: phrases.length,
        phraseVariantCount: phrasesVariants.length,
        shouldClauseCount: shouldClauses.length,
        payloadSize: JSON.stringify(queryJson).length,
        extractMs,
        variantMs,
        buildMs
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

    if (
        metrics.phraseVariantCount > VARIANT_THRESHOLD ||
        metrics.shouldClauseCount > SHOULD_THRESHOLD
    ) {
        logger.warn(
            {
                caseReferenceNumber,
                queryHash: metrics.queryHash,
                variantCount: metrics.phraseVariantCount,
                shouldClauseCount: metrics.shouldClauseCount
            },
            '[QueryBuilder] Variant/clause count exceeds safe threshold'
        );
    }
}

/**
 * Builds an OpenSearch query JSON object based on the provided search parameters.
 *
 * The query:
 * - Filters by an exact `case_ref` using a `term` query.
 * - Extracts date phrases from the keyword and adds them as `match_phrase` queries.
 * - Adds remaining keyword text as a `match` query against `chunk_text`.
 * - Applies pagination using `from` and `size`.
 * - Supports keyword, semantic, and hybrid search types.
 *
 * @param {object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 * @param {object} [params.logger] - Optional structured logger instance.
 * @param {'keyword' | 'semantic' | 'hybrid'} [params.searchType='keyword'] - Which search mode to use.
 * @param {boolean} [params.includePagination=true] - Whether to include pagination fields in the query.
 * @param {boolean} [params.enableDateExtraction=true] - Enables date extraction and variant matching.
 * @param {number} [params.keywordBoost] - Boost multiplier for the lexical sub-query in hybrid mode.
 * @param {number} [params.dateBoost] - Boost multiplier for date variant clauses in hybrid mode.
 * @param {number} [params.semanticBoost] - Boost multiplier for the neural sub-query in hybrid mode.
 * @param {string} [params.documentId] - Document UUID to scope results to a single document and page. When provided, the query is restricted to the matching page within that document.
 * @returns {object} OpenSearch query DSL JSON object.
 */
function buildQueryJson({
    keyword,
    caseReferenceNumber,
    pageNumber,
    itemsPerPage,
    logger,
    searchType = 'keyword',
    includePagination = true,
    enableDateExtraction = true,
    keywordBoost = DEFAULT_LEXICAL_BOOST,
    dateBoost = DEFAULT_DATE_BOOST,
    semanticBoost = DEFAULT_NEURAL_BOOST,
    documentId
}) {
    const buildStart = Date.now();

    const {
        shouldClauses,
        phrases,
        phrasesVariants,
        timings: { extractMs, variantMs }
    } = buildDateAwareShouldClauses({ keyword, enableDateExtraction });

    const { safePageNumber, safeItemsPerPage } = normalisePagination(pageNumber, itemsPerPage);

    let queryJson;
    if (searchType === 'keyword') {
        queryJson = buildKeywordQuery({
            caseReferenceNumber,
            shouldClauses,
            safePageNumber,
            documentId
        });
    } else if (searchType === 'semantic') {
        queryJson = buildSemanticQuery({
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId
        });
    } else if (searchType === 'hybrid') {
        queryJson = buildHybridQuery({
            keyword,
            caseReferenceNumber,
            shouldClauses,
            safePageNumber,
            documentId,
            keywordBoost,
            dateBoost,
            semanticBoost
        });
    } else {
        throw new Error(`Invalid search type: ${searchType}`);
    }

    if (includePagination === true) {
        queryJson.from = safeItemsPerPage * (safePageNumber - 1);
        queryJson.size = safeItemsPerPage;
    }

    if (queryJson?.query?.bool?.should?.length === 0) {
        delete queryJson.query.bool.should;
        delete queryJson.query.bool.minimum_should_match;
    }

    const buildEnd = Date.now();
    logQueryMetrics({
        queryJson,
        keyword,
        phrases,
        phrasesVariants,
        shouldClauses,
        buildMs: buildEnd - buildStart,
        extractMs,
        variantMs,
        logger,
        caseReferenceNumber
    });

    return queryJson;
}

export default buildQueryJson;
