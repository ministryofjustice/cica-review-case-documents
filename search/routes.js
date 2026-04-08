import express from 'express';
import createApiJwtToken from '../service/request/create-api-jwt-token.js';
import { renderHtml as defaultRenderHtml } from '../templateEngine/render-html.js';

/**
 * Creates an Express router for handling search functionality.
 *
 * @param {Object} services - The services required to create the router.
 * @param {Function} services.createSearchService - Factory function to create the search service.
 * @param {Function} [services.renderHtml=defaultRenderHtml] - Shared HTML render helper.
 * @returns {express.Router} The configured Express router for search routes.
 *
 * @route POST /search
 * @route GET /search
 */
function createSearchRouter({ createSearchService, renderHtml = defaultRenderHtml }) {
    const router = express.Router();

    router.post('/', (req, res, next) => {
        try {
            const { query } = req.body;
            const { pageNumber = 1 } = req.query;

            return res.redirect(
                `/search?query=${encodeURIComponent(query.trim())}&pageNumber=${pageNumber}`
            );
        } catch (err) {
            next(err);
        }
    });

    router.get('/', async (req, res, next) => {
        try {
            const { query, pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.query;

            if (!query) {
                const pageData = {
                    caseSelected: req.session.caseSelected,
                    caseReferenceNumber: req.session.caseReferenceNumber,
                    pageType: 'search'
                };
                return res.send(renderHtml('search/page/index.njk', pageData, req, res));
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
                query
            };

            req.log.info({ query, pageNumber, itemsPerPage }, 'Creating search service');
            const searchService = createSearchService({
                caseReferenceNumber: req.session?.caseReferenceNumber,
                logger: req.log
            });

            const token = createApiJwtToken(req.session?.username);
            const response = await searchService.getSearchResults(
                encodeURIComponent(query),
                pageNumber,
                itemsPerPage,
                token
            );
            const { body } = response || {};

            if (body?.errors) {
                templateParams.errors = body.errors.map((error) => ({
                    text: error.detail,
                    href: `#${error.source?.pointer?.split('/')?.pop() || 'error'}`
                }));

                return res
                    .status(400)
                    .send(renderHtml('search/page/results.njk', templateParams, req, res));
            }

            const searchResults = body?.data?.attributes?.results;
            const hits = searchResults?.hits || [];
            const totalItemCount = Number(searchResults?.total?.value || 0);

            // Enrich each result with docUuid, searchTerm, and caseReferenceNumber (crn)
            const searchResultsWithDocUuid = hits.map((hit) => ({
                ...hit,
                docUuid: hit._source?.source_doc_id || 0,
                searchTerm: query,
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

            return res
                .status(200)
                .send(renderHtml('search/page/results.njk', templateParams, req, res));
        } catch (error) {
            req.log.error('Error occurred while processing search request:', error);
            next(error);
        }
    });

    return router;
}

export default createSearchRouter;
