'use strict';

import express from 'express';
import createDocumentsService from './documents-service.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
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

        const documentsService = createDocumentsService({
            caseReferenceNumber: req.get('On-Behalf-Of')
        });
        const documentsResults = await documentsService.getDocuments();
        res.status(200).json(documentsResults);
    } catch (err) {
        next(err);
    }
});

router.get('/:documentId', async (req, res, next) => {
    try {
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

        const documentsService = createDocumentsService({
            caseReferenceNumber: req.get('On-Behalf-Of')
        });
        const documentsResults = await documentsService.getDocument(req.params.documentId);
        res.status(200).json(documentsResults);
    } catch (err) {
        next(err);
    }
});

export default router;
