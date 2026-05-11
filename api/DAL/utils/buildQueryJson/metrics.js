import crypto from 'node:crypto';
import './types.js';

const VARIANT_THRESHOLD = 50; // date variant count above which we log a warning, as this could indicate an explosion in the number of should clauses and potential performance issues
const SHOULD_THRESHOLD = 50; // should clause count above which we log a warning, as this could indicate an explosion in the number of should clauses and potential performance issues

/**
 * Computes and logs query metrics with threshold warnings.
 *
 * @param {QueryMetricsParams} params - Logging inputs.
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

    logger?.info(
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

export { logQueryMetrics, SHOULD_THRESHOLD, VARIANT_THRESHOLD };
