'use strict';

import express from 'express';
import createSearchService from './search-service.js';

const router = express.Router();

router.get('/', (req, res) => {
    return res.render('search/page/index.njk', {
        csrfToken: res.locals.csrfToken,
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'search'
    });
});

router.post('/', (req, res) => {
    // THIS ROUTE NEEDS TO BE VALIDATED BY THE VALIDATOR!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // IS `q` an acceptable param name?
    const query = req.body.q;
    return res.redirect(`/search/${query}`);
});

router.get('/:query', (req, res) => {
    return res.redirect(`/search/${req.params.query}/1/${process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE}`);
});

router.get('/:query/:pageNumber', (req, res) => {
    return res.redirect(`/search/${req.params.query}/${req.params.pageNumber}/${process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE}`);
});

router.get('/:query/:pageNumber/:itemsPerPage', async (req, res) => {
    const searchService = createSearchService({
        caseReferenceNumber: req?.session?.caseData?.case_ref
    });
    const response = await searchService.getSearchResults(req.params.query, req.params.pageNumber, req.params.itemsPerPage);
    const searchResultsResource = response.body;

    let currentPage = Number(req.params.pageNumber);

    // if (currentPage < 1 || isNaN(currentPage)) {
    //     return res.redirect(`/search/${req.params.query}/page/1`);
    // }

    if (currentPage > searchResultsResource.pagesTotal) {
        return res.redirect(`/search/${req.params.query}/${searchResultsResource.pagesTotal}/${req.params.itemsPerPage}`);
    }

    return res.render('search/page/results.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'search',
        query: req.params.query,
        pagination: {
            itemCount: searchResultsResource.itemsTotal,
            pageCount: searchResultsResource.pagesTotal,
            currentPage: searchResultsResource.pageCurrent,
            itemsPerPage: req.params.itemsPerPage,
            from: searchResultsResource.from,
            to: searchResultsResource.to,
            firstPage: searchResultsResource.pageCurrent <= 1,
            lastPage: searchResultsResource.pageCurrent >= searchResultsResource.pagesTotal
        },
        searchResults: searchResultsResource.results
    });
});

export default router;
