'use strict';

import createDBQuery from '../db/index.js';

function createDocumentDAL({
    caseReferenceNumber
}) {
    const db = createDBQuery();

    async function getDocuments() {
        return [];
    }

    async function getDocument(documentId) {
        return [];
    }

    async function getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage) {
        let response;
        try {
            response = await db.query({
                index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                body: {
                    from: itemsPerPage * (pageNumber - 1),
                    size: itemsPerPage,
                    query: {
                        bool: {
                            must: [,
                                {
                                    // https://stackoverflow.com/questions/50818424/elasticsearch-query-not-giving-exact-match
                                    // Instead of match you have to use term query, as the documentation describe:
                                    // The term query finds documents that contain the exact term specified in the inverted index
                                    match: {
                                        'chunk_text': keyword.toLowerCase()
                                    }
                                },
                                {
                                    match: {
                                        case_ref: caseReferenceNumber
                                    }
                                }
                            ]
                        }
                    }
                }
            });
        } catch (err) {
            throw err;
        }
        return response?.body?.hits;
    }

    return Object.freeze({
        getDocuments,
        getDocument,
        getDocumentsChunksByKeyword
    });
}

export default createDocumentDAL;
