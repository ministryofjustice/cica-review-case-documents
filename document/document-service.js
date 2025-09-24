'use strict';

// import createDocumentDAL from '../document/document-dal.js';
import createRequestService from '../service/request/index.js'

function createDocumentService(options = {
}) {
    const {get} = createRequestService();

    async function getDocuments() {
        const opts = {
            url: `${process.env.APP_API_URL}/documents`,
            headers: {
                // Authorization: `Bearer ${process.env.CW_DCS_JWT}`,
                'On-Behalf-Of': options.caseReferenceNumber
            }
        };

        return get(opts);
    }

    async function getDocument(documentId) {
        const opts = {
            url: `${process.env.APP_API_URL}/documents/${documentId}`,
            headers: {
                // Authorization: `Bearer ${process.env.CW_DCS_JWT}`,
                'On-Behalf-Of': options.caseReferenceNumber
            }
        };

        return get(opts);
    }

    return Object.freeze({
        getDocuments,
        getDocument
    });
}

export default createDocumentService;
