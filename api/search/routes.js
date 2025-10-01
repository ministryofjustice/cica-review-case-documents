'use strict';

import express from 'express';
import createSearchService from './search-service.js';

const router = express.Router();

router.get('/:query/:pageNumber/:itemsPerPage', async (req, res, next) => {
    try {
        const {query, pageNumber, itemsPerPage} = req.params;
        // const questionnaireService = createQuestionnaireService({
        //     logger: req.log,
        //     apiVersion: req.get('Dcs-Api-Version'),
        //     ownerId: req.get('On-Behalf-Of')
        // });
        // const progressEntries = await questionnaireService.getProgressEntries(
        //     questionnaireId,
        //     req.query
        // );

        // res.status(200).json(progressEntries);

        const searchService = createSearchService({
            caseReferenceNumber: req.get('On-Behalf-Of')
        });
        const searchResults = await searchService.getSearchResultsByKeyword(query, pageNumber, itemsPerPage);
        res.status(200).json(searchResults);
    } catch (err) {
        next(err);
    }
});

export default router;
