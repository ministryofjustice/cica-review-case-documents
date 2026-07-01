import SEARCH_TYPES, { DEFAULT_SEARCH_TYPE } from '../../../search/constants/searchTypes.js';
import logQueryMetrics from '../logQueryMetrics/index.js';
import {
    DEFAULT_QUERY_MODE,
    queryStructureBuilders as defaultQueryStructureBuilders,
    QUERY_MODES
} from './queryStructureBuilders.js';
import {
    createQueryTypeBuilders,
    queryTypeBuilders as defaultQueryTypeBuilders
} from './queryTypeBuilders.js';

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
 * Assembles an OpenSearch query DSL object for the given search mode.
 *
 * Dispatches to the appropriate mode-specific builder based on `searchType` and
 * applies pagination, optional document scoping, and structured logging.
 *
 * Valid search modes:
 * | searchType                    | Effective mode     |
 * |-------------------------------|--------------------|
 * | SEARCH_TYPES.KEYWORD          | keyword only       |
 * | SEARCH_TYPES.KEYWORD_DATES    | keyword + dates    |
 * | SEARCH_TYPES.SEMANTIC         | semantic only      |
 * | SEARCH_TYPES.HYBRID           | hybrid             |
 * | SEARCH_TYPES.HYBRID_DATES     | hybrid + dates     |
 *
 * @param {object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 * @param {object} [params.options] - Optional behavioural overrides.
 * @param {object} [params.options.logger] - Optional structured logger instance.
 * @param {string} [params.options.searchType=DEFAULT_SEARCH_TYPE] - Search mode. One of SEARCH_TYPES.KEYWORD, SEARCH_TYPES.KEYWORD_DATES, SEARCH_TYPES.SEMANTIC, SEARCH_TYPES.HYBRID, or SEARCH_TYPES.HYBRID_DATES.
 * @param {'search'|'page-metadata'} [params.options.queryMode='search'] - Query builder mode.
 * @param {boolean} [params.options.includePagination=true] - Whether to include pagination fields in the query.
 * @param {boolean} [params.options.includeNamedQueries=false] - Whether to include named-query `_name` metadata in the generated DSL.
 * @param {string[]|boolean|{includes?: string[], excludes?: string[]}} [params.options.sourceFields] - Optional OpenSearch `_source` projection.
 * @param {object} [params.options.queryDslConfig] - Optional tuning overrides for semantic thresholds, ANN k, and default boosts.
 * @param {string} [params.options.documentId] - Document UUID to scope results to a single document and page.
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
        queryMode = DEFAULT_QUERY_MODE,
        includePagination = true,
        includeNamedQueries = false,
        sourceFields,
        documentId,
        queryDslConfig
    } = {}
}) {
    const buildStart = Date.now();
    const effectiveQueryMode = queryMode ?? DEFAULT_QUERY_MODE;

    const { safePageNumber, safeItemsPerPage } = normalisePagination(pageNumber, itemsPerPage);

    let queryJson;
    let phrases = [];
    let phrasesVariants = [];
    let shouldClauses = [];
    let extractMs = 0;
    let variantMs = 0;

    switch (effectiveQueryMode) {
        case QUERY_MODES.PAGE_METADATA: {
            const queryStructureBuilder = defaultQueryStructureBuilders[effectiveQueryMode];
            queryJson = queryStructureBuilder({
                documentId,
                safePageNumber,
                caseReferenceNumber,
                keyword,
                logger,
                includeNamedQueries
            });
            break;
        }
        case QUERY_MODES.SEARCH: {
            // Re-use the module-level default builder map when no config overrides are
            // provided — avoids rebuilding the map and re-merging config on every request.
            const queryTypeBuilders = queryDslConfig
                ? createQueryTypeBuilders({ queryDslConfig })
                : defaultQueryTypeBuilders;
            // dispatch to the appropriate mode-specific builder. Each builder handles
            // its own date preprocessing (keyword and hybrid extract dates, semantic
            // skips preprocessing entirely for efficiency).
            const queryTypeBuilder = queryTypeBuilders[searchType];
            if (!queryTypeBuilder) {
                throw new Error(
                    `Invalid searchType "${searchType}". Must be one of: ${Object.values(SEARCH_TYPES).join(', ')}`
                );
            }

            const builderParams = {
                keyword,
                caseReferenceNumber,
                safePageNumber,
                documentId,
                logger,
                includeNamedQueries
            };

            ({ queryJson, phrases, phrasesVariants, shouldClauses, extractMs, variantMs } =
                queryTypeBuilder(builderParams));
            break;
        }
        default:
            throw new Error(
                `Invalid queryMode "${effectiveQueryMode}". Must be one of: ${Object.values(QUERY_MODES).join(', ')}`
            );
    }

    if (includePagination === true) {
        queryJson.from = safeItemsPerPage * (safePageNumber - 1);
        queryJson.size = safeItemsPerPage;
    }

    if (sourceFields !== undefined) {
        queryJson._source = sourceFields;
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
        queryMode: effectiveQueryMode,
        safePageNumber,
        documentId,
        includeNamedQueries,
        sourceFields,
        queryDslConfig
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
