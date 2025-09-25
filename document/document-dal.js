'use strict';

import createDBQuery from '../db/index.js';

import {
    DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD,
    DUMMY_DOCUMENTS
} from '../dummy/index.js';

function createDocumentDAL() {
    const db = createDBQuery();

    async function getAllDocuments(caseReferenceNumber) {
        // let document;

        // try {
        //     document = await db.query(
        //         'SELECT document FROM documents WHERE id = $1',
        //         [documentId]
        //     );

        //     if (document.rowCount === 0) {
        //         throw new VError(
        //             {
        //                 name: 'ResourceNotFound'
        //             },
        //             `Document "${documentId}" not found`
        //         );
        //     }
        // } catch (err) {
        //     throw err;
        // }

        // return document.rows[0].document;
        return DUMMY_DOCUMENTS;
    }

    async function getDocument(documentId) {
        // let document;

        // try {
        //     document = await db.query(
        //         'SELECT document FROM documents WHERE id = $1',
        //         [documentId]
        //     );

        //     if (document.rowCount === 0) {
        //         throw new VError(
        //             {
        //                 name: 'ResourceNotFound'
        //             },
        //             `Document "${documentId}" not found`
        //         );
        //     }
        // } catch (err) {
        //     throw err;
        // }

        // return document.rows[0].document;
        return DUMMY_DOCUMENTS.filter(document => document.document_id === documentId)[0];
    }

    async function getDocumentsChunksByKeyword(query) {
        // let document;

        // try {
        //     document = await db.query(
        //         'SELECT document FROM documents WHERE keyword = $1',
        //         [query]
        //     );

        //     if (document.rowCount === 0) {
        //         throw new VError(
        //             {
        //                 name: 'ResourceNotFound'
        //             },
        //             `Document "${documentId}" not found`
        //         );
        //     }
        // } catch (err) {
        //     throw err;
        // }

        // return document.rows;
        return DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD;
    }

    return Object.freeze({
        getAllDocuments,
        getDocument,
        getDocumentsChunksByKeyword
    });
}

export default createDocumentDAL;
