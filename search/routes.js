import express from 'express';
import {
    FEATURE_FLAG_ENUM_OPTIONS,
    getFeatureFlagValue,
    parseEnumFlagValue
} from '../middleware/featureFlags/index.js';
import createApiJwtToken from '../service/request/create-api-jwt-token.js';

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
            const { query, type: rawSearchType } = req.body;
            const { pageNumber = 1 } = req.query;
            const searchType = parseEnumFlagValue(rawSearchType, FEATURE_FLAG_ENUM_OPTIONS.type);

            const redirectParams = new URLSearchParams({
                query: query.trim(),
                pageNumber: String(pageNumber)
            });

            if (searchType) {
                redirectParams.set('type', searchType);
            }

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
                const html = render('search/page/index.njk', {
                    caseSelected: req.session.caseSelected,
                    caseReferenceNumber: req.session.caseReferenceNumber,
                    pageType: 'search',
                    csrfToken: res.locals.csrfToken,
                    cspNonce: res.locals.cspNonce,
                    userName,
                    searchType
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
                searchType
            };

            req.log.info({ query, pageNumber, itemsPerPage }, 'Creating search service');
            const searchService = createSearchService({
                caseReferenceNumber: req.session?.caseReferenceNumber,
                logger: req.log
            });

            const token = createApiJwtToken(userName);
            const response = await searchService.getSearchResults(
                encodeURIComponent(query),
                pageNumber,
                itemsPerPage,
                token,
                {
                    searchType
                }
            );
            const { body } = response || {};

            if (body?.errors) {
                templateParams.errors = body.errors.map((error) => ({
                    text: error.detail,
                    href: `#${error.source?.pointer?.split('/')?.pop() || 'error'}`
                }));

                const html = render('search/page/results.njk', templateParams);
                return res.status(400).send(html);
            }

            const searchResults = body?.data?.attributes?.results;
            const hits = searchResults?.hits || [];
            const totalItemCount = Number(searchResults?.total?.value || 0);

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
