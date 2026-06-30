import crypto from 'node:crypto';
import express from 'express';
import buildQueryJson from '../api/DAL/utils/buildQueryJson/index.js';
import { resolveSearchType } from '../api/search/constants/searchTypes.js';
import { finalizeDebugInfo, hasDebugContext, ifDebugContext } from '../middleware/debug/index.js';
import { getFeatureFlagValue } from '../middleware/featureFlags/index.js';
import createApiJwtToken from '../service/request/create-api-jwt-token.js';
import buildViewModel from '../templateEngine/buildViewModel.js';
import buildSearchSessionPreference from '../utils/buildSearchSessionPreference/index.js';
import createSavedSearchStoreDefault from './saved-search-store.js';

/**
 * Creates an Express router for handling search functionality.
 *
 * @param {Object} services - The services required to create the router.
 * @param {Function} services.createTemplateEngineService - Factory function to create the template engine service.
 * @param {Function} services.createSearchService - Factory function to create the search service.
 * @param {Function} [services.createSavedSearchStore] - Optional factory function to create the saved search store.
 * @returns {express.Router} The configured Express router for search routes.
 *
 * @route POST /search
 * @route GET /search
 * @route GET /search/s/:searchId
 */
function createSearchRouter({
    createTemplateEngineService,
    createSearchService,
    createSavedSearchStore = createSavedSearchStoreDefault
}) {
    const router = express.Router();
    let savedSearchStore = null;
    if (typeof createSavedSearchStore === 'function') {
        try {
            savedSearchStore = createSavedSearchStore();
        } catch {
            // Keep legacy behavior when saved-search persistence is not configured.
            savedSearchStore = null;
        }
    }

    /**
     * Renders search results using either raw query input or a saved search definition.
     *
     * @param {express.Request} req - Express request object.
     * @param {express.Response} res - Express response object.
     * @param {express.NextFunction} next - Express next middleware callback.
     * @param {{query: string, searchType: string, searchId?: string}} options - Search rendering options.
     * @returns {Promise<void>} Resolves when the response is sent.
     */
    async function renderSearchResults(req, res, next, { query, searchType, searchId }) {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;
            const { pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.query;
            const userName = req.session?.username;
            const isDebugMode = Boolean(hasDebugContext(res));
            const debugQueryDslOverrides = isDebugMode
                ? res.locals.debugQueryDslOverrides || {}
                : {};
            const debugQueryDslConfig = res.locals.debugQueryDslConfig;

            const pageNumber = Math.max(Number(rawPageNumber) || 1, 1);
            const itemsPerPage = Math.max(
                Number(rawItemsPerPage) || Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
                1
            );

            const templateParams = buildViewModel(req, res, {
                pageType: 'search',
                query,
                searchType,
                searchId,
                isDebugMode
            });

            req.log?.debug?.(
                { query, pageNumber, itemsPerPage, searchId },
                'Creating search service'
            );
            const searchService = createSearchService({
                caseReferenceNumber: req.session?.caseReferenceNumber,
                logger: req.log
            });

            const token = createApiJwtToken(userName);
            const searchOptions = { searchType };
            if (isDebugMode) {
                searchOptions.includeNamedQueries = true;
                // In debug mode, pass the effective DSL tuning bag consistently.
                searchOptions.queryDslConfig = debugQueryDslOverrides;
            }
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
                searchId,
                searchType,
                isDebugMode,
                caseReferenceNumber: req.session?.caseReferenceNumber,
                featureFlags: res.locals.featureFlags
            }));

            templateParams.searchResults = searchResultsWithDocUuid;
            templateParams.searchTerm = query;

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
    }

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

            if (savedSearchStore?.create) {
                return savedSearchStore
                    .create({
                        query: query.trim(),
                        searchType,
                        caseReferenceNumber: req.session?.caseReferenceNumber,
                        itemsPerPage: Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
                        ownerUserName: req.session?.username
                    })
                    .then(({ id }) => {
                        return res.redirect(
                            `/search/s/${encodeURIComponent(id)}?pageNumber=${pageNumber}`
                        );
                    })
                    .catch(next);
            }

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

            const { query } = req.query;
            const searchType = getFeatureFlagValue(req.session, 'type');
            const isDebugMode = Boolean(hasDebugContext(res));

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

            return renderSearchResults(req, res, next, {
                query: String(query),
                searchType,
                searchId: undefined
            });
        } catch (error) {
            req.log.error('Error occurred while processing search request:', error);
            next(error);
        }
    });

    router.get('/s/:searchId', async (req, res, next) => {
        try {
            if (!savedSearchStore?.getById) {
                return res.status(404).send('Not Found');
            }

            const { searchId } = req.params;
            const savedSearch = await savedSearchStore.getById(searchId);
            if (!savedSearch) {
                return res.status(404).send('Not Found');
            }

            if (savedSearch.caseReferenceNumber !== req.session?.caseReferenceNumber) {
                return res.status(403).send('Forbidden');
            }

            return renderSearchResults(req, res, next, {
                query: savedSearch.query,
                searchType: resolveSearchType(savedSearch.searchType, req.session),
                searchId
            });
        } catch (error) {
            req.log.error('Error occurred while processing saved search request:', error);
            next(error);
        }
    });

    return router;
}

export default createSearchRouter;
