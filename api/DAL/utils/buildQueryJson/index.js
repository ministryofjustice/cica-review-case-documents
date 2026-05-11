import { logQueryMetrics } from './metrics.js';
import {
    DEFAULT_DATE_BOOST,
    DEFAULT_LEXICAL_BOOST,
    DEFAULT_NEURAL_BOOST,
    queryModeBuilders
} from './modeBuilders.js';
import { SEARCH_TYPES } from './types.js';
import './types.js';

/**
 * Normalises raw pageNumber and itemsPerPage inputs to safe integer values.
 *
 * @param {number} pageNumber - Raw page number (1-based).
 * @param {number} itemsPerPage - Raw items-per-page value.
 * @returns {NormalisedPaginationResult} Normalised pagination values.
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
 * Builds an OpenSearch query JSON object based on the provided search parameters.
 *
 * This function orchestrates the query building process:
 * - Normalizes inputs (pagination)
 * - Dispatches to the appropriate mode-specific builder
 * - Each builder handles its own preprocessing (date extraction for keyword/hybrid)
 * - Applies pagination and cleanup
 * - Logs metrics and warnings
 *
 * The query:
 * - Filters by an exact `case_ref` using a `term` query.
 * - Supports keyword, semantic, and hybrid search types via the strategy pattern.
 * - Keyword/hybrid modes extract dates and add as `match_phrase` queries.
 * - Semantic mode uses neural embeddings, skipping date preprocessing.
 *
 * @param {object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 * @param {object} [params.options={}] - Optional query behavior configuration.
 * @param {object} [params.options.logger] - Optional structured logger instance.
 * @param {'keyword' | 'semantic' | 'hybrid'} [params.options.searchType='keyword'] - Which search mode to use.
 * @param {boolean} [params.options.includePagination=true] - Whether to include pagination fields in the query.
 * @param {boolean} [params.options.enableDateExtraction=true] - Enables date extraction and variant matching (keyword/hybrid only).
 * @param {string} [params.options.documentId] - Document UUID to scope results to a single document and page.
 * @param {HybridBoostConfig} [params.options.boostConfig] - Boost multipliers for hybrid mode only. Ignored for keyword/semantic modes.
 * @returns {object} OpenSearch query DSL JSON object.
 * @throws {Error} If the search type is not in the supported modes (keyword, semantic, hybrid).
 */
function buildQueryJson({ keyword, caseReferenceNumber, pageNumber, itemsPerPage, options = {} }) {
    const {
        logger,
        searchType = SEARCH_TYPES.KEYWORD,
        includePagination = true,
        enableDateExtraction = true,
        documentId,
        boostConfig = {}
    } = options;

    const buildStart = Date.now();

    // Normalize pagination parameters to safe integers.
    const { safePageNumber, safeItemsPerPage } = normalisePagination(pageNumber, itemsPerPage);

    // Dispatch to the appropriate mode-specific builder.
    // Each builder handles its own date preprocessing (keyword and hybrid extract dates,
    // semantic skips preprocessing entirely for efficiency).
    const modeBuilder = queryModeBuilders[searchType];
    if (!modeBuilder) {
        throw new Error(
            `Invalid search type: ${searchType}. Supported types: ${Object.values(SEARCH_TYPES).join(', ')}`
        );
    }

    // Build params for the mode builder. Only include boosts for hybrid mode.
    const builderParams = {
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        enableDateExtraction
    };

    // Only apply boosts if hybrid mode is selected.
    if (searchType === SEARCH_TYPES.HYBRID) {
        builderParams.keywordBoost = boostConfig.keywordBoost ?? DEFAULT_LEXICAL_BOOST;
        builderParams.dateBoost = boostConfig.dateBoost ?? DEFAULT_DATE_BOOST;
        builderParams.semanticBoost = boostConfig.semanticBoost ?? DEFAULT_NEURAL_BOOST;
    }

    const { queryJson, phrases, phrasesVariants, shouldClauses, extractMs, variantMs } =
        modeBuilder(builderParams);

    // Apply pagination if requested.
    if (includePagination === true) {
        queryJson.from = safeItemsPerPage * (safePageNumber - 1);
        queryJson.size = safeItemsPerPage;
    }

    // Clean up empty should clauses.
    if (queryJson?.query?.bool?.should?.length === 0) {
        delete queryJson.query.bool.should;
        delete queryJson.query.bool.minimum_should_match;
    }

    // Log metrics and threshold warnings.
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
