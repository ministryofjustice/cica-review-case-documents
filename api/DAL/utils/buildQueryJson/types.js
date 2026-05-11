/**
 * @typedef {Object} SearchParams
 * @property {string} keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @property {string} caseReferenceNumber - Exact case reference number to filter results by.
 * @property {number} pageNumber - The current page number (1-based).
 * @property {number} itemsPerPage - Number of results to return per page.
 * @property {object} [logger] - Optional structured logger instance.
 * @property {'keyword' | 'semantic' | 'hybrid'} [searchType='keyword'] - Which search mode to use.
 * @property {boolean} [includePagination=true] - Whether to include pagination fields in the query.
 * @property {boolean} [enableDateExtraction=true] - Enables date extraction and variant matching.
 * @property {number} [keywordBoost] - Boost multiplier for the lexical sub-query in hybrid mode.
 * @property {number} [dateBoost] - Boost multiplier for date variant clauses in hybrid mode.
 * @property {number} [semanticBoost] - Boost multiplier for the neural sub-query in hybrid mode.
 * @property {string} [documentId] - Document UUID to scope results to a single document and page.
 */

/**
 * Supported search types and their corresponding queries.
 * @enum {string}
 */
const SEARCH_TYPES = Object.freeze({
    /** Lexical (BM25) search on text and extracted dates. */
    KEYWORD: 'keyword',
    /** Neural embedding search on semantic content. */
    SEMANTIC: 'semantic',
    /** Combined lexical and neural search with configurable boost factors. */
    HYBRID: 'hybrid'
});

/**
 * @typedef {Object} NormalisedPaginationResult
 * @property {number} safePageNumber - Normalised 1-based page number.
 * @property {number} safeItemsPerPage - Normalised items-per-page value.
 */

/**
 * @typedef {Object} DateAwareShouldClausesResult
 * @property {Array<object>} shouldClauses - OpenSearch should clauses for lexical matching.
 * @property {Array<string>} phrases - Extracted date phrases.
 * @property {Array<string>} phrasesVariants - Expanded phrase variants.
 * @property {Object} timings - Performance metrics.
 * @property {number} timings.extractMs - Date extraction duration in ms.
 * @property {number} timings.variantMs - Variant generation duration in ms.
 */

/**
 * @typedef {Object} QueryMetricsParams
 * @property {object} queryJson - Final query payload.
 * @property {string} keyword - Raw search string.
 * @property {Array<string>} phrases - Extracted date phrases.
 * @property {Array<string>} phrasesVariants - Expanded phrase variants.
 * @property {Array<object>} shouldClauses - Generated lexical clauses.
 * @property {number} buildMs - Build duration in ms.
 * @property {number} extractMs - Extraction duration in ms.
 * @property {number} variantMs - Variant generation duration in ms.
 * @property {object} [logger] - Optional structured logger.
 * @property {string} caseReferenceNumber - Case reference scope for logs.
 */

/**
 * @typedef {Object} ModeBuilderParams
 * @property {string} keyword - Raw search string.
 * @property {string} caseReferenceNumber - Exact case reference number.
 * @property {Array<object>} shouldClauses - Lexical should clauses.
 * @property {number} safePageNumber - Normalised page number.
 * @property {string} [documentId] - Optional document ID scope.
 * @property {number} [keywordBoost] - Lexical boost factor.
 * @property {number} [dateBoost] - Date boost factor.
 * @property {number} [semanticBoost] - Neural boost factor.
 */

/**
 * @typedef {Object} HybridBoostConfig
 * @property {number} [keywordBoost] - Boost multiplier for lexical sub-query in hybrid mode (default 12).
 * @property {number} [dateBoost] - Boost multiplier for date variant clauses in hybrid mode (default 1).
 * @property {number} [semanticBoost] - Boost multiplier for neural sub-query in hybrid mode (default 4).
 */

export { SEARCH_TYPES };
