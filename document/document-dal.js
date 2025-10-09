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
        return DUMMY_DOCUMENTS.filter(document => document.document_id === documentId)[0];
    }

    async function getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage) {
        let response;
        console.log({
            pageNumber,
            itemsPerPage,
            pageNumberMinusOne: (pageNumber - 1),
            from: itemsPerPage * (pageNumber - 1)
        })
        try {
            response = await db.query({
                index: 'case-documents',
                body: {
                    from: itemsPerPage * (pageNumber - 1),
                    size: itemsPerPage,
                    query: {
                        match: {
                            chunk_text: {
                                query: keyword,
                            }
                        }
                    }
                }
            });
        } catch (err) {
            throw err;
        }

        return response?.body?.hits;

        // if (query === 'abc123') {
        //     return {};
        // }

        // const from = (pageNumber - 1) * itemsPerPage + 1;
        // const to = Math.min(pageNumber * itemsPerPage, DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length);
        // return {
        //     pagesTotal: Math.ceil(DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length / itemsPerPage),
        //     pageCurrent: pageNumber,
        //     itemsTotal: DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.length,
        //     from: from,
        //     to: to,
        //     results: DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD.slice(from - 1, to)
        // };
    }

    return Object.freeze({
        getDocuments,
        getDocument,
        getDocumentsChunksByKeyword
    });
}

export default createDocumentDAL;
