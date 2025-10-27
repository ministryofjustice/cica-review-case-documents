'use strict';

import express from 'express';
import createSearchService from './search-service.js';

const router = express.Router();

router.get('/:query/:pageNumber/:itemsPerPage', async (req, res, next) => {
    try {
        const {query, pageNumber, itemsPerPage} = req.params;
        const searchService = createSearchService({
            caseReferenceNumber: req.get('On-Behalf-Of')
        });
        const searchResults = await searchService.getSearchResultsByKeyword(query, pageNumber, itemsPerPage);

        const searchResultsResource = {
            data: {
                type: 'search-results',
                id: '3983c5c8-10d8-4a84-97fd-e682081f242e',
                attributes: {
                    query: query,
                    results: searchResults
                }
            }
        };
        res.status(200).json(searchResultsResource);
    } catch (err) {
        next(err);
    }
});

export default router;
