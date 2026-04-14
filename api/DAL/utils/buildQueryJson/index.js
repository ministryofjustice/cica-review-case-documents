import crypto from 'node:crypto';
import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';

const SEMANTIC_MIN_SCORE = 0.6;

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
 * @param {'keyword' | 'semantic' | 'all'} [params.searchType='keyword'] - Which search mode to use.
 *
 * @returns {Object} OpenSearch query DSL JSON object.
 */
function buildQueryJson({
    keyword,
    caseReferenceNumber,
    pageNumber,
    itemsPerPage,
    logger,
    searchType = 'keyword'
}) {
    const startBuild = Date.now();
    const queryJson = {
        from: itemsPerPage * (pageNumber - 1),
        size: itemsPerPage
    };
    const lexicalQuery = {
        bool: {
            // `term` is used for exact matching of the case reference
            // number, otherwise it will be tokenised.
            must: [{ term: { case_ref: caseReferenceNumber } }]
        }
    };

    const extractStart = Date.now();
    const {
        dates: phrases,
        remainingText,
        matchedPatterns
    } = extractDatesFromSearchString(keyword);
    const extractEnd = Date.now();

    const shouldClauses = [];

    const variantStart = Date.now();
    // build variants for each extracted phrase, falling back to the
    // original phrase if no variants are produced, and then
    // deduplicate (via the new Set) across all phrases.
    const phrasesVariants = Array.from(
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
    const variantEnd = Date.now();

    // add match_phrase queries for each extracted date phrase.
    if (phrasesVariants.length !== 0) {
        phrasesVariants.forEach((phrase) => {
            shouldClauses.push({
                match_phrase: {
                    chunk_text: phrase
                }
            });
        });
    }

    // add match query for remaining text.
    if (remainingText) {
        shouldClauses.push({
            match: {
                chunk_text: {
                    query: remainingText,
                    operator: 'or'
                }
            }
        });
    }

    if (shouldClauses.length > 0) {
        lexicalQuery.bool.should = shouldClauses;
        lexicalQuery.bool.minimum_should_match = 1;
    }

    const hasKeyword = keyword.trim().length > 0;
    const runKeywordSearch = searchType === 'keyword' || searchType === 'all';
    const runSemanticSearch = (searchType === 'semantic' || searchType === 'all') && hasKeyword;

    if (runSemanticSearch) {
        queryJson.min_score = SEMANTIC_MIN_SCORE;
    }

    const neuralQuery = {
        neural: {
            embedding: {
                query_text: keyword,
                k: queryJson.from + queryJson.size,
                filter: {
                    term: { case_ref: caseReferenceNumber }
                }
            }
        }
    };

    if (runKeywordSearch && runSemanticSearch) {
        const hybridQueries = [];

        if (shouldClauses.length > 0) {
            hybridQueries.push(lexicalQuery);
        }

        hybridQueries.push(neuralQuery);

        queryJson.query = {
            hybrid: {
                queries: hybridQueries
            }
        };
    } else if (runSemanticSearch) {
        queryJson.query = neuralQuery;
    } else {
        queryJson.query = lexicalQuery;
    }

    // metrics.
    const buildEnd = Date.now();
    const phraseCount = phrases.length;
    const variantCount = phrasesVariants.length;
    const shouldClauseCount = shouldClauses.length;
    const payloadSize = JSON.stringify(queryJson).length;
    const extractMs = extractEnd - extractStart;
    const variantMs = variantEnd - variantStart;
    const buildMs = buildEnd - startBuild;

    // thresholds.
    const VARIANT_THRESHOLD = 50;
    const SHOULD_THRESHOLD = 50;

    // safe query hash for correlation, not raw text.
    const queryHash = crypto.createHash('sha256').update(keyword).digest('hex').slice(0, 8);
    if (logger) {
        logger.info(
            {
                caseReferenceNumber,
                queryHash,
                phraseCount,
                variantCount,
                shouldClauseCount,
                payloadSize,
                extractMs,
                variantMs,
                buildMs
            },
            '[QueryBuilder] Query metrics'
        );
        if (variantCount > VARIANT_THRESHOLD || shouldClauseCount > SHOULD_THRESHOLD) {
            logger.warn(
                {
                    caseReferenceNumber,
                    queryHash,
                    variantCount,
                    shouldClauseCount
                },
                '[QueryBuilder] Variant/clause count exceeds safe threshold'
            );
        }
    }

    return queryJson;
}

export default buildQueryJson;
