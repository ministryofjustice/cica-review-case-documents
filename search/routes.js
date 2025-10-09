'use strict';

import express from 'express';
import createSearchService from './search-service.js';
import base64encodeBoundingBoxData from './utils/base64encodeBoundingBoxData/index.js'

const router = express.Router();

router.get('/', (req, res, next) => {
    try {
        return res.render('search/page/index.njk', {
            csrfToken: res.locals.csrfToken,
            caseSelected: req.session.caseSelected,
            caseData: req.session.caseData,
            pageType: 'search'
        });
    } catch (err) {
        next(err);
    }
});

router.post('/', (req, res, next) => {
    try {
        // THIS ROUTE NEEDS TO BE VALIDATED BY THE VALIDATOR!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // IS `q` an acceptable param name?
        const query = req.body.q;
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
        const searchService = createSearchService({
            caseReferenceNumber: req?.session?.caseData?.case_ref
        });

        const response = await searchService.getSearchResults(req.params.query, req.params.pageNumber, req.params.itemsPerPage);
        const searchResultsResource = response.body;

        // let currentPage = Number(req.params.pageNumber);

        // // if (currentPage < 1 || isNaN(currentPage)) {
        // //     return res.redirect(`/search/${req.params.query}/page/1`);
        // // }

        // if (currentPage > searchResultsResource.pagesTotal) {
        //     return res.redirect(`/search/${req.params.query}/${searchResultsResource.pagesTotal}/${req.params.itemsPerPage}`);
        // }

        return res.render('search/page/results.njk', {
            caseSelected: req.session.caseSelected,
            caseData: req.session.caseData,
            pageType: 'search',
            query: req.params.query,
            pagination: {
                totalItemCount: Number(searchResultsResource.total.value),
                totalPageCount: Math.ceil(Number(searchResultsResource.total.value) / Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE)),
                currentPageIndex: Number(req.params.pageNumber),
                itemsPerPage:  Number(req.params.itemsPerPage),
                from: Number(req.params.itemsPerPage) * (Number(req.params.pageNumber) - 1) + 1,
                to: Math.min(Number(req.params.pageNumber) * Number(req.params.itemsPerPage), Number(searchResultsResource.total.value)),
                firstPage: Number(req.params.pageNumber) <= 1,
                lastPage: Number(req.params.pageNumber) >= Math.ceil(Number(searchResultsResource.total.value) / Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE))
            },
            // searchResults: searchResultsResource.results ? base64encodeBoundingBoxData(searchResultsResource.results) : searchResultsResource.results
            searchResults: searchResultsResource.hits
        });
    } catch (err) {
        next(err);
    }
});

export default router;
