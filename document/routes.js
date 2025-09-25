'use strict';

import express from 'express';
import createDocumentService from './document-service.js';

const router = express.Router();

router.get('/', (req, res) => {
    const documentService = createDocumentService();
    const response = documentService.getAllDocuments();
    const documentsResource = response.data;

    return res.render('document/page/index.njk', {
        csrfToken: res.locals.csrfToken,
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'document',
        documentsResource
    });
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

router.get('/:documentId/view/image/page/:page', (req, res) => {
    const documentService = createDocumentService();

    let currentPage = Number(req.params.page);
    const response = documentService.getDocumentPageByDocumentId(req.params.documentId, currentPage);
    const documentResource = response;
    const documentPageCount = documentResource.pagesCount;
    const totalPageCount = Math.ceil(documentPageCount / process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE);

    if (currentPage < 1 || isNaN(currentPage)) {
        return res.redirect(`/document/${req.params.query}/view/image/page/1`);
    }

    if (currentPage > totalPageCount) {
        return res.redirect(`/document/${req.params.query}/view/image/page/${totalPageCount}`);
    }


    const from = (currentPage - 1) * process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE, documentPageCount);

    return res.render('document/page/document-image.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'document',
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
        documentResource
    });
});

router.get('/:documentId/view/text/page/:page', (req, res) => {
    const documentService = createDocumentService();

    let currentPage = Number(req.params.page);
    const response = documentService.getDocumentPageByDocumentId(req.params.documentId, currentPage);
    const documentResource = response;
    const documentPageCount = documentResource.pagesCount;
    const totalPageCount = Math.ceil(documentPageCount / process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE);

    if (currentPage < 1 || isNaN(currentPage)) {
        return res.redirect(`/document/${req.params.query}/view/image/page/1`);
    }

    if (currentPage > totalPageCount) {
        return res.redirect(`/document/${req.params.query}/view/image/page/${totalPageCount}`);
    }


    const from = (currentPage - 1) * process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.CRDC_DOCUMENT_PAGINATION_ITEMS_PER_PAGE, documentPageCount);

    return res.render('document/page/document-text.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'document',
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
        documentResource
    });
});

export default router;
