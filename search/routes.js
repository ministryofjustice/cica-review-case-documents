'use strict';

import express from 'express';
import createSearchService from './search-service.js';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();

router.get('/', (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('search/page/index.njk', {
            caseSelected: req.session.caseSelected,
            caseReferenceNumber: req.session.caseReferenceNumber,
            pageType: 'search',
            csrfToken: res.locals.csrfToken,
            cspNonce: res.locals.cspNonce
        });
        res.send(html);
    } catch (err) {
        next(err);
    }
});

router.post('/', (req, res, next) => {
    try {
        const {query} = req.body;
        return res.redirect(`/search/${query}`);
    } catch (err) {
        next(err);
    }
});

router.get('/:query', (req, res, next) => {
    try {
        return res.redirect(`/search/${req.params.query}/1/${process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE}`);
    } catch (err) {
        next(err);
    }
});

router.get('/:query/:pageNumber', (req, res, next) => {
    try {
        return res.redirect(`/search/${req.params.query}/${req.params.pageNumber}/${process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE}`);
    } catch (err) {
        next(err);
    }
});

router.get('/:query/:pageNumber/:itemsPerPage', async (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;

        const { query, pageNumber: rawPageNumber, itemsPerPage: rawItemsPerPage } = req.params;
        const pageNumber = Math.max(Number(rawPageNumber) || 1, 1);
        const itemsPerPage = Math.max(Number(rawItemsPerPage) || 10, 1);

        const templateParams = {
            caseSelected: req.session.caseSelected,
            caseReferenceNumber: req.session.caseReferenceNumber,
            pageType: 'search',
            csrfToken: res.locals.csrfToken,
            cspNonce: res.locals.cspNonce,
            query,
        };

        req.log.info({ query, pageNumber, itemsPerPage }, "Creating search service");
        const searchService = createSearchService({
            caseReferenceNumber: req.session?.caseReferenceNumber,
            logger: req.log
        });

        const response = await searchService.getSearchResults(query, pageNumber, itemsPerPage);
        const { body } = response || {};

        if (body?.errors) {
            templateParams.errors = body.errors.map(error => ({
                text: error.detail,
                href: `#${error.source?.pointer?.split('/')?.pop() || 'error'}`,
            }));

            const html = render('search/page/results.njk', templateParams);
            return res.status(400).send(html);
        }

        const searchResults = body?.data?.attributes?.results;
        const hits = searchResults?.hits || [];
        const totalItemCount = Number(searchResults?.total?.value || 0);

        templateParams.searchResults = hits;
        templateParams.showPagination = totalItemCount > itemsPerPage;

        if (templateParams.showPagination) {
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
                isLastPage: currentPageIndex >= totalPageCount,
            };
        }

        const html = render('search/page/results.njk', templateParams);
        return res.status(200).send(html);

    } catch (error) {
        next(error);
    }
});

export default router;
