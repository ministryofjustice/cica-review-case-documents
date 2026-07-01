import createDocumentDALDefault from '../../DAL/document-dal.js';
import { DEFAULT_SEARCH_TYPE } from '../../search/constants/searchTypes.js';

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
     * @param {string} [context.searchType='hybrid-dates'] - Search mode (one of SEARCH_TYPES).
     * @param {boolean} [context.includeNamedQueries=false] - Whether to include named query metadata in the generated DSL.
     * @param {object} [context.queryDslConfig] - Optional debug-only DSL tuning overrides.
    * @param {string[]|boolean|{includes?: string[], excludes?: string[]}} [context.sourceFields] - Optional `_source` projection for OpenSearch queries.
     * @returns {Promise<Array<Object>>} Array of chunks with bounding boxes.
     */
    async function getPageChunks(
        documentId,
        pageNumber,
        crn,
        searchTerm,
        {
            logger,
            searchType = DEFAULT_SEARCH_TYPE,
            includeNamedQueries,
            queryDslConfig,
            sourceFields
        } = {}
    ) {
        const dal = createDocumentDALFactory({
            caseReferenceNumber: crn,
            logger,
            includeNamedQueries,
            queryDslConfig
        });

        let chunks;
        try {
            chunks = await dal.getPageChunksByDocumentIdAndPageNumber(
                documentId,
                pageNumber,
                searchTerm,
                searchType,
                sourceFields === undefined ? undefined : { sourceFields }
            );
        } catch (error) {
            logger?.error(
                {
                    error: error.message,
                    documentId,
                    pageNumber,
                    searchTerm,
                    searchType
                },
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
