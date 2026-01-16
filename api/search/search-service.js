import createDocumentDAL from '../../document/document-dal.js';

/**
 * Factory function that creates a Search Service for retrieving documents
 * based on keyword searches within a specific case reference.
 *
 * @module services/searchService
 */

/**
 * Creates a Search Service instance.
 *
 * @param {Object} params - The parameters for creating the search service.
 * @param {Function} [params.createDocumentDAL] - A factory for the Document DAL.
 * @returns {Object} The search service instance.
 */
function createSearchService({ createDocumentDAL: dalFactory = createDocumentDAL }) {
    /**
     * Retrieves a paginated list of document search results matching a given keyword.
     *
     * @async
     * @function getSearchResultsByKeyword
     * @param {string} keyword - The keyword to search for within the documents.
     * @param {number} pageNumber - The current page number (1-based index).
     * @param {number} itemsPerPage - The number of items to include per page.
     * @param {Object} context - The context for the search operation.
     * @param {string} context.caseReferenceNumber - The case reference number.
     * @param {Object} context.logger - The logger instance.
     * @returns {Promise<Object[]>} A promise that resolves to an array of document results.
     */
    async function getSearchResultsByKeyword(
        keyword,
        pageNumber,
        itemsPerPage,
        { caseReferenceNumber, logger }
    ) {
        const db = dalFactory({
            caseReferenceNumber,
            logger
        });
        return db.getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
