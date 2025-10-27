'use strict';

import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';
import createSearchService from './search-service.js';
import base64encodeBoundingBoxData from './utils/base64encodeBoundingBoxData/index.js'
import emphasiseTermsInResultsArray from './utils/emphasiseTermsInResultsArray/index.js'

const router = express.Router();

router.get('/', (req, res, next) => {
    try {
        return res.render('search/page/index.njk', {
            caseSelected: req.session.caseSelected,
            caseReferenceNumber: req.session.caseReferenceNumber,
            pageType: 'search',
            csrfToken: res.locals.csrfToken
        });
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
        const {render} = templateEngineService;

        let html;
        const templateParams = {
            caseSelected: req.session.caseSelected,
            caseReferenceNumber: req.session.caseReferenceNumber,
            pageType: 'search',
            csrfToken: res.locals.csrfToken,
            query: req.params.query,
        };

        const searchService = createSearchService({
            caseReferenceNumber: req?.session?.caseReferenceNumber
        });

        const pageNumber = Number(req.params.pageNumber);
        const itemsPerPage = Number(req.params.itemsPerPage);
        const response = await searchService.getSearchResults(templateParams.query, pageNumber, itemsPerPage);

        if ('errors' in response.body) {
            const errors = response.body.errors.map((error) => {
                return {
                    text: error.detail,
                    href: `#${error.source.pointer.split('/').pop()}`
                }
            });
            templateParams.errors = errors;
            html = render('search/page/results.njk', templateParams);
            return res.send(html);
        }

        const searchResultsResource = response?.body?.data?.attributes;
        templateParams.searchResults = emphasiseTermsInResultsArray(searchResultsResource.results.hits, [templateParams.query])
        const totalItemCount = Number(searchResultsResource.results.total.value);
        templateParams.showPagination = totalItemCount > itemsPerPage;

        if (templateParams.showPagination === true) {
            const totalPageCount = Math.ceil(totalItemCount / itemsPerPage);
            const currentPageIndex = Math.min(Number(pageNumber), totalPageCount);
            templateParams.pagination = {
                totalItemCount,
                totalPageCount,
                currentPageIndex,
                itemsPerPage,
                from: itemsPerPage * (Number(pageNumber) - 1) + 1,
                to: Math.min(currentPageIndex * itemsPerPage, totalItemCount),
                firstPage: Number(pageNumber) <= 1,
                lastPage: Number(pageNumber) >= totalPageCount
            };
        }

        // if (pageNumber > totalPageCount) {
        //     return res.redirect(`/search/${req.params.query}/${totalPageCount}/${itemsPerPage}`);
        // }

        html = render('search/page/results.njk', templateParams);
        return res.send(html);
    } catch (err) {
        next(err);
    }
});

export default router;
