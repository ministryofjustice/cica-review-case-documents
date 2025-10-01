'use strict';

import createDBQuery from '../db/index.js';

import {
    DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD,
    DUMMY_DOCUMENTS
} from '../dummy/index.js';

function createDocumentDAL({
    caseReferenceNumber
}) {
    const db = createDBQuery();

    async function getDocuments() {
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
        return DUMMY_DOCUMENTS.filter(document => document.case_ref === caseReferenceNumber);
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
        console.log({thing: DUMMY_DOCUMENTS.filter(document => document.document_id === documentId)[0]});
        return DUMMY_DOCUMENTS.filter(document => document.document_id === documentId)[0];
    }

    async function getDocumentsChunksByKeyword(query, pageNumber, itemsPerPage) {
        // let document;

        // try {
        //     document = await db.query(
        //         'SELECT document FROM documents WHERE keyword = $1',
        //         [query, caseReferenceNumber]
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

        const from = (pageNumber - 1) * process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE + 1;
        const to = Math.min(pageNumber * process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE, DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length);
        return {
            pagesTotal: Math.ceil(DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length / process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
            pageCurrent: pageNumber,
            itemsTotal: DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length,
            from: from,
            to: to,
            results: DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.slice(from - 1, to)
        };
    }

    return Object.freeze({
        getDocuments,
        getDocument,
        getDocumentsChunksByKeyword
    });
}

export default createDocumentDAL;
