import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';
import createSearchService from './search-service.js';

const router = express.Router();

router.post('/', (req, res, next) => {
    try {
        const { query } = req.body;
        return res.redirect(`/search?query=${encodeURIComponent(query.trim())}`);
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;

        const { query, pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.query;

        if (!query) {
            const html = render('search/page/index.njk', {
                caseSelected: req.session.caseSelected,
                caseReferenceNumber: req.session.caseReferenceNumber,
                pageType: 'search',
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce
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
            query
        };

        req.log.info({ query, pageNumber, itemsPerPage }, 'Creating search service');
        const searchService = createSearchService({
            caseReferenceNumber: req.session?.caseReferenceNumber,
            logger: req.log
        });

        const token = req.cookies?.jwtToken;
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

            const html = render('search/page/results.njk', templateParams);
            return res.status(400).send(html);
        }

        const searchResults = body?.data?.attributes?.results;
        const hits = searchResults?.hits || [];
        const totalItemCount = Number(searchResults?.total?.value || 0);

        templateParams.searchResults = hits;

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
        next(error);
    }
});

export default router;
