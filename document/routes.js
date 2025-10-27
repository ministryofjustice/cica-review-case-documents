'use strict';

import express from 'express';
import createDocumentService from './document-service.js';
import decodeHighlightData from './utils/decodeHighlightData/index.js'

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const documentService = createDocumentService();
        // const documentService = createDocumentService({
        //     caseReferenceNumber: req?.session?.caseData?.case_ref
        // });
        const response = await documentService.getDocuments();
        const documentsResource = response.body;

        return res.render('document/page/index.njk', {
            csrfToken: res.locals.csrfToken,
            // caseSelected: req.session.caseSelected,
            // caseData: req.session.caseData,
            pageType: ['document'],
            documentsResource
        });
    } catch (err) {
        next(err);
    }
});

router.get('/:documentId', (req, res) => {
    return res.redirect(`/document/${req.params.documentId}/view/image/page/1`);
});

router.get('/:documentId/page/:page', (req, res) => {
    return res.redirect(`/document/${req.params.documentId}/view/image/page/${req.params.page}`);
});

router.get('/:documentId/view/image', (req, res) => {
    return res.redirect(`/document/${req.params.documentId}/view/image/page/1`);
});

router.get('/:documentId/view/text', (req, res) => {
    return res.redirect(`/document/${req.params.documentId}/view/text/page/1`);
});

router.get('/:documentId/view/image/page/:page', async (req, res) => {
    const documentService = createDocumentService();
    // const documentService = createDocumentService({
    //     caseReferenceNumber: req?.session?.caseData?.case_ref
    // });
    const response = await documentService.getDocument(req.params.documentId, req.params.page);
    const documentResource = response.body;

    const documentPageCount = documentResource.page_count;
    const totalPageCount = Math.ceil(documentPageCount / process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE);

    let currentPage = Number(req.params.page);
    // if (currentPage < 1 || isNaN(currentPage)) {
    //     return res.redirect(`/document/${req.params.documentId}/view/image/page/1`);
    // }

    if (currentPage > totalPageCount) {
        return res.redirect(`/document/${req.params.documentId}/view/image/page/${totalPageCount}`);
    }

    const from = (currentPage - 1) * process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE, documentPageCount);

    let highlightData;
    if (req?.query?.h) {
        highlightData = decodeHighlightData(req.query.h);
    }

    return res.render('document/page/document-image.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['document', 'document-image'],
        documentId: req.params.documentId,
        pagination: {
            itemCount: documentPageCount,
            pageCount: totalPageCount,
            currentPage: currentPage,
            from,
            to,
            firstPage: currentPage <= 1,
            lastPage: currentPage >= totalPageCount
        },
        documentResource,
        highlights: highlightData
    });
});

router.get('/:documentId/view/text/page/:page', async (req, res) => {
    const documentService = createDocumentService();
    const response = await documentService.getDocument(req.params.documentId); // , currentPage);

    const documentPageCount = response.page_count;
    const totalPageCount = Math.ceil(documentPageCount / process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE);

    let currentPage = Number(req.params.page);
    if (currentPage < 1 || isNaN(currentPage)) {
        return res.redirect(`/document/${req.params.query}/view/image/page/1`);
    }

    if (currentPage > totalPageCount) {
        return res.redirect(`/document/${req.params.query}/view/image/page/${totalPageCount}`);
    }

    const from = (currentPage - 1) * process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE, documentPageCount);

    return res.render('document/page/document-text.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['document', 'document-text'],
        documentId: req.params.documentId,
        pagination: {
            itemCount: documentPageCount,
            pageCount: totalPageCount,
            currentPage: currentPage,
            from,
            to,
            firstPage: currentPage <= 1,
            lastPage: currentPage >= totalPageCount
        },
        documentResource: response
    });
});

export default router;
