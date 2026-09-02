import crypto from 'node:crypto';
import express from 'express';
import createDocumentDALDefault from '../api/DAL/document-dal.js';
import buildQueryJson from '../api/DAL/utils/buildQueryJson/index.js';
import { resolveSearchType } from '../api/search/constants/searchTypes.js';
import { finalizeDebugInfo, hasDebugContext, ifDebugContext } from '../middleware/debug/index.js';
import { getFeatureFlagValue } from '../middleware/featureFlags/index.js';
import createApiJwtToken from '../service/request/create-api-jwt-token.js';
import buildViewModel from '../templateEngine/buildViewModel.js';
import buildSearchSessionPreference from '../utils/buildSearchSessionPreference/index.js';

/**
 * Resolves whether any document represented in the search results contains handwriting.
 *
 * The handwriting flag is scoped to the stable document ID (`source_doc_id`), not the
 * case reference number, so it stays document-specific. Results are cached in the session
 * keyed by document ID; only documents not already cached are looked up, and they are
 * resolved together in a single batched OpenSearch query (rather than one query each).
 *
 * The banner is shown when at least one document in the current results contains
 * handwriting anywhere in that document.
 *
 * @async
 * @param {Object} options - Resolution options.
 * @param {Object} options.session - Express session object.
 * @param {string[]} options.documentIds - Document IDs represented in the search results.
 * @param {string} options.crn - Case reference number (used to scope the DAL).
 * @param {Object} [options.logger] - Optional logger instance.
 * @param {Function} options.createDocumentDAL - Factory to create the document DAL.
 * @returns {Promise<boolean>} Whether any document in the results contains handwriting.
 */
async function resolveHasHandwriting({ session, documentIds, crn, logger, createDocumentDAL }) {
    const uniqueDocumentIds = [...new Set((documentIds || []).filter(Boolean))];

    if (uniqueDocumentIds.length === 0) {
        return false;
    }

    const cache = session?.hasHandwriting ?? {};

    // Serve cached documents without hitting OpenSearch, and collect the rest.
    let hasHandwriting = false;
    const uncachedDocumentIds = [];

    for (const documentId of uniqueDocumentIds) {
        const cached = cache[documentId];

        if (cached === undefined) {
            uncachedDocumentIds.push(documentId);
        } else if (cached === true) {
            hasHandwriting = true;
        }
    }

    if (uncachedDocumentIds.length === 0) {
        return hasHandwriting;
    }

    try {
        const dal = createDocumentDAL({
            caseReferenceNumber: crn,
            logger
        });

        // Single batched query for all uncached documents rather than one per document.
        const matchingDocumentIds =
            await dal.getDocumentsContainingHandwriting(uncachedDocumentIds);
        const matching = new Set(matchingDocumentIds);

        // Populate the session cache for every queried document: true for matches,
        // false for the rest, so subsequent searches short-circuit without querying.
        const updatedCache = { ...session?.hasHandwriting };
        for (const documentId of uncachedDocumentIds) {
            const documentHasHandwriting = matching.has(documentId);
            updatedCache[documentId] = documentHasHandwriting;
            if (documentHasHandwriting) {
                hasHandwriting = true;
            }
        }

        if (session) {
            session.hasHandwriting = updatedCache;
        }
    } catch (error) {
        logger?.warn?.(
            { err: error, documentIds: uncachedDocumentIds },
            'Failed to check handwriting status for documents'
        );
    }

    return hasHandwriting;
}

/**
 * Creates an Express router for handling search functionality.
 *
 * @param {Object} services - The services required to create the router.
 * @param {Function} services.createTemplateEngineService - Factory function to create the template engine service.
 * @param {Function} services.createSearchService - Factory function to create the search service.
 * @param {Function} [services.createDocumentDAL] - Factory function to create the document DAL.
 * @returns {express.Router} The configured Express router for search routes.
 *
 * @route POST /search
 * @route GET /search
 */
function createSearchRouter({
    createTemplateEngineService,
    createSearchService,
    createDocumentDAL = createDocumentDALDefault
}) {
    const router = express.Router();

    /**
     * Handles search form submissions and normalizes input into query-string based navigation.
     *
     * @param {express.Request} req - Express request containing body fields.
     * @param {express.Response} res - Express response used for redirects.
     * @param {express.NextFunction} next - Express next middleware callback.
     * @returns {void}
     */
    router.post('/', (req, res, next) => {
        try {
            const { query } = req.body;
            const { pageNumber = 1 } = req.query;
            const searchType = resolveSearchType(req.body?.type, req.session);

            const redirectParams = new URLSearchParams({
                query: query.trim(),
                pageNumber: String(pageNumber),
                type: searchType
            });

            return res.redirect(`/search?${redirectParams.toString()}`);
        } catch (err) {
            next(err);
        }
    });

    /**
     * Renders search index/results pages and coordinates API-backed search execution.
     *
     * @param {express.Request} req - Express request with query parameters and session context.
     * @param {express.Response} res - Express response used to send rendered HTML.
     * @param {express.NextFunction} next - Express next middleware callback.
     * @returns {Promise<void>}
     */
    router.get('/', async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            const { query, pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.query;
            const searchType = getFeatureFlagValue(req.session, 'type');
            const isDebugMode = Boolean(hasDebugContext(res));
            const debugQueryDslOverrides = isDebugMode
                ? res.locals.debugQueryDslOverrides || {}
                : {};
            const debugQueryDslConfig = res.locals.debugQueryDslConfig;

            if (!query) {
                finalizeDebugInfo(res, 200);
                const html = render(
                    'search/page/index.njk',
                    buildViewModel(req, res, {
                        pageType: 'search',
                        searchType,
                        isDebugMode
                    })
                );
                return res.send(html);
            }

            const pageNumber = Math.max(Number(rawPageNumber) || 1, 1);
            const itemsPerPage = Math.max(
                Number(rawItemsPerPage) || Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
                1
            );

            const templateParams = buildViewModel(req, res, {
                pageType: 'search',
                query,
                searchType,
                isDebugMode
            });

            req.log?.debug?.({ query, pageNumber, itemsPerPage }, 'Creating search service');
            const searchService = createSearchService({
                caseReferenceNumber: req.session?.caseReferenceNumber,
                logger: req.log
            });

            const searchOptions = { searchType };
            if (isDebugMode) {
                searchOptions.includeNamedQueries = true;
                // In debug mode, pass the effective DSL tuning bag consistently.
                searchOptions.queryDslConfig = debugQueryDslOverrides;
            }
            const token = createApiJwtToken(req.session?.entraUser?.oid);
            const response = await searchService.getSearchResults(
                query,
                pageNumber,
                itemsPerPage,
                token,
                searchOptions
            );

            const { body } = response || {};

            if (body?.errors) {
                templateParams.errors = body.errors.map((error) => ({
                    text: error.detail,
                    href: `#${error.source?.pointer?.split('/')?.pop() || 'error'}`
                }));

                finalizeDebugInfo(res, 400);
                const html = render('search/page/results.njk', templateParams);
                return res.status(400).send(html);
            }

            const searchResults = body?.data?.attributes?.results;
            const hits = searchResults?.hits || [];
            const totalItemCount = Number(searchResults?.total?.value || 0);

            // Populate debug info with search results when debug context is present.
            ifDebugContext(res, (debugInfo) => {
                debugInfo.request.queryDsl = buildQueryJson({
                    keyword: query,
                    caseReferenceNumber: req.session?.caseReferenceNumber,
                    pageNumber,
                    itemsPerPage,
                    options: {
                        searchType,
                        logger: req.log,
                        includeNamedQueries: isDebugMode,
                        queryDslConfig: debugQueryDslOverrides
                    }
                });
                const queryHash = crypto
                    .createHash('sha256')
                    .update(String(query))
                    .digest('hex')
                    .slice(0, 12);
                const sessionPreference = buildSearchSessionPreference(String(query));

                debugInfo.search = {
                    lastQuery: query,
                    lastDSL: null,
                    previousDSLs: [],
                    lastResults: {
                        totalHits: totalItemCount,
                        returnedHits: hits.length,
                        searchType
                    },
                    executionTime: body?.data?.attributes?.executionTime || null,
                    queryDslConfig: debugQueryDslConfig,
                    opensearch: {
                        ...(debugInfo.search?.opensearch || {}),
                        index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME || 'unknown',
                        preference: sessionPreference,
                        queryHash,
                        totalHits: totalItemCount,
                        returnedHits: hits.length
                    }
                };
            });

            // Enrich each result with docUuid, searchTerm, and caseReferenceNumber (crn)
            const searchResultsWithDocUuid = hits.map((hit) => ({
                ...hit,
                // OpenSearch may return repeated or unknown matched query names.
                // Keep only the constituent labels we expose in debug UI.
                matchSources: Array.from(
                    new Set(
                        (hit?.matched_queries || []).filter(
                            (name) => name === 'keyword' || name === 'dates' || name === 'semantic'
                        )
                    )
                ),
                docUuid: hit._source?.source_doc_id || 0,
                searchTerm: query,
                searchType,
                isDebugMode,
                caseReferenceNumber: req.session?.caseReferenceNumber,
                featureFlags: res.locals.featureFlags
            }));

            templateParams.searchResults = searchResultsWithDocUuid;
            templateParams.searchTerm = query;

            // Show the handwriting banner when any document represented in the results
            // contains handwriting. Scoped to the stable document ID, cached in session.
            templateParams.hasHandwriting = await resolveHasHandwriting({
                session: req.session,
                documentIds: searchResultsWithDocUuid.map((result) => result.docUuid),
                crn: req.session?.caseReferenceNumber,
                logger: req.log,
                createDocumentDAL
            });

            // TODO: move this logic into the view.
            templateParams.showPaginationItems = totalItemCount > itemsPerPage;

            const totalPageCount = Math.ceil(totalItemCount / itemsPerPage);
            const currentPageIndex = Math.min(pageNumber, totalPageCount);
            templateParams.pagination = {
                totalItemCount,
                totalPageCount,
                currentPageIndex,
                itemsPerPage,
                from: (currentPageIndex - 1) * itemsPerPage + 1,
                to: Math.min(currentPageIndex * itemsPerPage, totalItemCount),
                isFirstPage: currentPageIndex <= 1,
                isLastPage: currentPageIndex >= totalPageCount
            };

            finalizeDebugInfo(res, 200);
            const html = render('search/page/results.njk', templateParams);
            return res.status(200).send(html);
        } catch (error) {
            req.log.error('Error occurred while processing search request:', error);
            next(error);
        }
    });

    return router;
}

export default createSearchRouter;
