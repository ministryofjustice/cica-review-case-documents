import createDocumentDALDefault from '../../DAL/document-dal.js';

/**
 * Creates a Page Chunks Service for retrieving document page chunks with bounding boxes.
 * This service is focused solely on chunk operations, separate from page metadata.
 *
 * @param {Object} [options] - Optional configuration.
 * @param {Function} [options.createDocumentDAL] - Factory for document DAL.
 * @returns {Object} Service with `getPageChunks` method.
 */
function createPageChunksService({
    createDocumentDAL: createDocumentDALFactory = createDocumentDALDefault
} = {}) {
    /**
     * Fetch page chunks with bounding boxes from OpenSearch.
     *
     * @async
     * @param {string} documentId - The UUID of the document.
     * @param {string|number} pageNumber - The page number.
     * @param {string} crn - The case reference number.
     * @param {string} [searchTerm] - Optional search term to filter chunks.
     * @param {Object} [context] - Context for the call.
     * @param {Object} [context.logger] - Logger instance.
     * @returns {Promise<Array<Object>>} Array of chunks with bounding boxes.
     */
    async function getPageChunks(documentId, pageNumber, crn, searchTerm, { logger } = {}) {
        const dal = createDocumentDALFactory({
            caseReferenceNumber: crn,
            logger
        });

        let chunks;
        try {
            chunks = await dal.getPageChunksByDocumentIdAndPageNumber(
                documentId,
                pageNumber,
                searchTerm
            );
        } catch (error) {
            logger?.error(
                { error: error.message, documentId, pageNumber, searchTerm },
                'Failed to retrieve page chunks from OpenSearch'
            );
            const err = new Error(error.message);
            err.status = error.status || error.statusCode || 500;
            throw err;
        }

        return chunks;
    }

    return Object.freeze({
        getPageChunks
    });
}

export default createPageChunksService;
