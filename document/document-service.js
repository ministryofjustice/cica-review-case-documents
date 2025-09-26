'use strict';

import createDocumentDAL from '../document/document-dal.js';

function createDocumentService() {
    const db = createDocumentDAL();

    async function getAllDocuments(caseReferenceNumber) { // explicitly pass this in from the session data.
        return db.getAllDocuments(caseReferenceNumber);
    }

    async function getDocument(documentId) {
        return db.getDocument(documentId);
    }

    return Object.freeze({
        getAllDocuments,
        getDocument
    });
}

export default createDocumentService;
