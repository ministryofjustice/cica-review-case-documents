import SEARCH_TYPES, { DEFAULT_SEARCH_TYPE } from '../../../search/constants/searchTypes.js';
import logQueryMetrics from '../logQueryMetrics/index.js';
import { createQueryTypeBuilders, resolveQueryDslConfig } from './queryTypeBuilders.js';

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
 * Assembles the semantic (neural) query, applying optional document-scoping should clauses
 *
 * The query:
 * - Filters by an exact `case_ref` using a `term` query.
 * - Applies pagination using `from` and `size`.
 * - Composes results from up to four independently toggled capabilities:
 *   - **keyword** (`searchType`)  — BM25 lexical matching against `chunk_text`.
 *   - **semantic** (`searchType`) — neural vector matching via the `embedding` field.
 *
 * Valid combinations:
 * | searchType                    | Effective mode     |
 * |-------------------------------|--------------------|
 * | SEARCH_TYPES.KEYWORD          | keyword only       |
 * | SEARCH_TYPES.KEYWORD_DATES    | keyword + dates    |
 * | SEARCH_TYPES.SEMANTIC         | semantic only      |
 * | SEARCH_TYPES.HYBRID           | hybrid             |
 * | SEARCH_TYPES.HYBRID_DATES     | hybrid + dates     |
 *
 * `searchType` must be one of the SEARCH_TYPES values.
 *
 * @param {object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 * @param {object} [params.logger] - Optional structured logger instance.
 * @param {string} [params.searchType=DEFAULT_SEARCH_TYPE] - Search mode. One of SEARCH_TYPES.KEYWORD, SEARCH_TYPES.KEYWORD_DATES, SEARCH_TYPES.SEMANTIC, SEARCH_TYPES.HYBRID, or SEARCH_TYPES.HYBRID_DATES.
 * @param {boolean} [params.includePagination=true] - Whether to include pagination fields in the query.
 * @param {object} [params.queryDslConfig] - Optional tuning overrides for semantic thresholds, ANN k, and default boosts.
 * @param {string} [params.documentId] - Document UUID to scope results to a single document and page.
 * @returns {object} OpenSearch query DSL JSON object.
 */
function buildQueryJson({
    keyword,
    caseReferenceNumber,
    pageNumber,
    itemsPerPage,
    options: {
        logger,
        searchType = DEFAULT_SEARCH_TYPE,
        includePagination = true,
        documentId,
        queryDslConfig
    } = {}
}) {
    const buildStart = Date.now();

    const effectiveQueryDslConfig = resolveQueryDslConfig(queryDslConfig);
    const queryTypeBuilders = createQueryTypeBuilders({ queryDslConfig: effectiveQueryDslConfig });

    // dispatch to the appropriate mode-specific builder. Each builder handles
    // its own date preprocessing (keyword and hybrid extract dates, semantic
    // skips preprocessing entirely for efficiency).
    const queryTypeBuilder = queryTypeBuilders[searchType];
    if (!queryTypeBuilder) {
        throw new Error(
            `Invalid searchType "${searchType}". Must be one of: ${Object.values(SEARCH_TYPES).join(', ')}`
        );
    }

    const { safePageNumber, safeItemsPerPage } = normalisePagination(pageNumber, itemsPerPage);

    const builderParams = {
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        logger
    };

    const { queryJson, phrases, phrasesVariants, shouldClauses, extractMs, variantMs } =
        queryTypeBuilder(builderParams);

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
        caseReferenceNumber,
        searchType
    });

    const queryTypeBuilderParamsLog = {
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        effectiveQueryDslConfig
    };
    const prettyJsonEnabled = process.env.APP_LOG_PRETTY_JSON === 'true';
    const paramsPrettyJson = prettyJsonEnabled
        ? `\n${JSON.stringify(queryTypeBuilderParamsLog, null, 2)}`
        : '';
    const outputPrettyJson = prettyJsonEnabled ? `\n${JSON.stringify(queryJson, null, 2)}` : '';

    logger?.debug?.({ queryJson }, 'Built query JSON');

    logger?.debug?.(
        queryTypeBuilderParamsLog,
        `[BuildQueryJson] ${searchType} queryTypeBuilder parameters${paramsPrettyJson}`
    );
    logger?.debug?.(
        { queryJson },
        `[BuildQueryJson] ${searchType} queryTypeBuilder output${outputPrettyJson}`
    );

    return queryJson;
}

export default buildQueryJson;
