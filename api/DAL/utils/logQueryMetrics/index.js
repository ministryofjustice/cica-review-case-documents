import crypto from 'node:crypto';
import SEARCH_TYPES from '../../../search/constants/searchTypes.js';

const VARIANT_THRESHOLD = 50;
const SHOULD_THRESHOLD = 50;

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
 * @param {string} [params.searchType] - The effective search mode (one of SEARCH_TYPES).
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
    caseReferenceNumber,
    searchType = SEARCH_TYPES.KEYWORD_DATES
}) {
    const metrics = {
        queryHash: crypto.createHash('sha256').update(keyword).digest('hex').slice(0, 8),
        searchType,
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

export default logQueryMetrics;
