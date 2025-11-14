'use strict';

import createDocumentDAL from '../../document/document-dal.js';

/**
 * Factory function that creates a Search Service for retrieving documents
 * based on keyword searches within a specific case reference.
 *
 * @module services/searchService
 */

/**
 * Creates a Search Service instance bound to a specific case reference number.
 *
 * @param {Object} params - The parameters for creating the search service.
 * @param {string} params.caseReferenceNumber - The unique identifier for the case.
 * @param {Object} params.logger - The logger instance to use for logging.
 * @returns {Object} The search service instance.
 * @returns {Function} return.getSearchResultsByKeyword - Retrieves paginated search results by keyword.
 */
function createSearchService({
    caseReferenceNumber,
    logger
}) {
    const db = createDocumentDAL({
        caseReferenceNumber,
        logger
    });

    /**
     * Retrieves a paginated list of document search results matching a given keyword.
     *
     * @async
     * @function getSearchResultsByKeyword
     * @param {string} keyword - The keyword to search for within the documents.
     * @param {number} pageNumber - The current page number (1-based index).
     * @param {number} itemsPerPage - The number of items to include per page.
     * @returns {Promise<Object[]>} A promise that resolves to an array of document results.
     */
    async function getSearchResultsByKeyword(keyword, pageNumber, itemsPerPage) {
        return db.getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
