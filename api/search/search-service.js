'use strict';

import createDocumentDAL from '../../document/document-dal.js';

function createSearchService({
    caseReferenceNumber
}) {
    const db = createDocumentDAL({
        caseReferenceNumber
    });

    async function getSearchResultsByKeyword(keyword, pageNumber, itemsPerPage) {
        return db.getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
