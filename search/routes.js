import express from 'express';
import crypto from 'node:crypto';
import { resolveSearchType } from '../api/search/constants/searchTypes.js';
import { getFeatureFlagValue } from '../middleware/featureFlags/index.js';
import createApiJwtToken from '../service/request/create-api-jwt-token.js';

function finalizeDebugInfo(res, statusCode) {
    if (typeof res.locals?.finalizeDebugInfo === 'function') {
        res.locals.finalizeDebugInfo({ responseStatus: statusCode });
    }
}

/**
 * Creates an Express router for handling search functionality.
 *
 * @param {Object} services - The services required to create the router.
 * @param {Function} services.createTemplateEngineService - Factory function to create the template engine service.
 * @param {Function} services.createSearchService - Factory function to create the search service.
 * @returns {express.Router} The configured Express router for search routes.
 *
 * @route POST /search
 * @route GET /search
 */
function createSearchRouter({ createTemplateEngineService, createSearchService }) {
    const router = express.Router();

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

    router.get('/', async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            const { query, pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.query;
            const userName = req.session?.username;
            const searchType = getFeatureFlagValue(req.session, 'type');

            if (!query) {
                finalizeDebugInfo(res, 200);
                const html = render('search/page/index.njk', {
                    caseSelected: req.session.caseSelected,
                    caseReferenceNumber: req.session.caseReferenceNumber,
                    pageType: 'search',
                    csrfToken: res.locals.csrfToken,
                    cspNonce: res.locals.cspNonce,
                    userName,
                    searchType,
                    featureFlags: res.locals.featureFlags,
                    debugInfo: res.locals.debugInfo
                });
                return res.send(html);
            }

            const pageNumber = Math.max(Number(rawPageNumber) || 1, 1);
            const itemsPerPage = Math.max(
                Number(rawItemsPerPage) || Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
                1
            );

            const templateParams = {
                caseSelected: req.session.caseSelected,
                caseReferenceNumber: req.session.caseReferenceNumber,
                pageType: 'search',
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                userName,
                query,
                searchType,
                featureFlags: res.locals.featureFlags,
                debugInfo: res.locals.debugInfo
            };

            req.log?.debug?.({ query, pageNumber, itemsPerPage }, 'Creating search service');
            const searchService = createSearchService({
                caseReferenceNumber: req.session?.caseReferenceNumber,
                logger: req.log
            });

            const token = createApiJwtToken(userName);
            const apiCallStartTime = Date.now();
            let response;
            try {
                response = await searchService.getSearchResults(
                    encodeURIComponent(query),
                    pageNumber,
                    itemsPerPage,
                    token,
                    { searchType }
                );

                res.locals.recordDebugApiCall?.({
                    method: 'GET',
                    path: '/api/search',
                    statusCode: response?.statusCode || 200,
                    durationMs: Date.now() - apiCallStartTime,
                    source: 'search-service'
                });
            } catch (error) {
                res.locals.recordDebugApiCall?.({
                    method: 'GET',
                    path: '/api/search',
                    statusCode: error?.response?.statusCode || 500,
                    durationMs: Date.now() - apiCallStartTime,
                    source: 'search-service',
                    errorMessage: error?.message || 'API request failed'
                });
                throw error;
            }

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

            // Populate debug info with search results if debug is enabled
            if (res.locals.debugInfo) {
                const queryHash = crypto
                    .createHash('sha256')
                    .update(String(query))
                    .digest('hex')
                    .slice(0, 12);

                res.locals.debugInfo.search = {
                    lastQuery: query,
                    lastDSL: body?.data?.attributes?.dsl || null,
                    previousDSLs: [],
                    lastResults: {
                        totalHits: totalItemCount,
                        returnedHits: hits.length,
                        searchType
                    },
                    executionTime: body?.data?.attributes?.executionTime || null,
                    opensearch: {
                        index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME || 'unknown',
                        queryHash,
                        totalHits: totalItemCount,
                        returnedHits: hits.length,
                        apiDurationMs: res.locals.debugInfo.apiCalls
                            .slice()
                            .reverse()
                            .find((call) => call.path === '/api/search')?.durationMs
                    }
                };
            }

            // Enrich each result with docUuid, searchTerm, and caseReferenceNumber (crn)
            const searchResultsWithDocUuid = hits.map((hit) => ({
                ...hit,
                docUuid: hit._source?.source_doc_id || 0,
                searchTerm: query,
                searchType,
                caseReferenceNumber: req.session?.caseReferenceNumber
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
    });

    return router;
}

export default createSearchRouter;
