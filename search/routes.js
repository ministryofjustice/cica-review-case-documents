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
    const query = req.body.q;
    return res.redirect(`/search/${query}`);
});

router.get('/:query', (req, res) => {
    return res.redirect(`/search/${req.params.query}/page/1`);
});

router.get('/:query/page/:page', async (req, res) => {
    const searchService = createSearchService();
    const results = await searchService.getSearchResultsByKeyword(req.params.query);

    const totalResultsLength = results.length;
    const totalPageCount = Math.ceil(results.length / process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE);

    let currentPage = Number(req.params.page);

    if (currentPage < 1 || isNaN(currentPage)) {
        return res.redirect(`/search/${req.params.query}/page/1`);
    }

    if (currentPage > totalPageCount) {
        return res.redirect(`/search/${req.params.query}/page/${totalPageCount}`);
    }
    const from = (currentPage - 1) * process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE, results.length);

    return res.render('search/page/results.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'search',
        query: req.params.query,
        pagination: {
            itemCount: totalResultsLength,
            pageCount: totalPageCount,
            currentPage: currentPage,
            from,
            to,
            firstPage: currentPage <= 1,
            lastPage: currentPage >= totalPageCount
        },
        searchResults: results.slice(from - 1, to) // should include pagination data at this point, either determined locally, or at the "server" level.
    });
});

export default router;
