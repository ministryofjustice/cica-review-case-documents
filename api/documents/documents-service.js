'use strict';

import Ajv from 'ajv';
import AjvErrors from 'ajv-errors';
import VError from 'verror';
import createDocumentDAL from '../../document/document-dal.js'

function createDocumentsService({
    caseReferenceNumber
}) {
    const db = createDocumentDAL({
        caseReferenceNumber
    });

    const ajv = new Ajv({
        allErrors: true,
        jsonPointers: true,
        format: 'full',
        coerceTypes: true
    });

    AjvErrors(ajv);

    async function getDocuments() {
        // validateQuery(keyword);
        return db.getDocuments();
    }

    async function getDocument(documentId, pageNumber) {
        // validateQuery(keyword);
        return db.getDocument(documentId, pageNumber);
    }

    return Object.freeze({
        getDocuments,
        getDocument
    });
}

export default createDocumentsService;
