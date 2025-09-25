'use strict';

import createDocumentDAL from '../document/document-dal.js';

function createSearchService() {
    const db = createDocumentDAL();

    async function getSearchResultsByKeyword(keyword) {
        return db.getDocumentsChunksByKeyword(keyword);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
