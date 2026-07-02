import createDocumentDAL from '../DAL/document-dal.js';
import { DEFAULT_SEARCH_TYPE } from './constants/searchTypes.js';

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
     * @param {string} [context.searchType=DEFAULT_SEARCH_TYPE] - Search mode. One of SEARCH_TYPES.KEYWORD, SEARCH_TYPES.KEYWORD_DATES, SEARCH_TYPES.SEMANTIC, SEARCH_TYPES.HYBRID, or SEARCH_TYPES.HYBRID_DATES.
     * @param {boolean} [context.includeNamedQueries] - Optional explicit override for named query metadata.
     * @param {object} [context.queryDslConfig] - Optional debug-only DSL tuning overrides.
     * @param {string[]|boolean|{includes?: string[], excludes?: string[]}} [context.sourceFields] - Optional `_source` projection for OpenSearch queries.
     * @returns {Promise<Object[]>} A promise that resolves to an array of document results.
     */
    async function getSearchResultsByKeyword(
        keyword,
        pageNumber,
        itemsPerPage,
        {
            caseReferenceNumber,
            logger,
            searchType = DEFAULT_SEARCH_TYPE,
            includeNamedQueries,
            queryDslConfig,
            sourceFields
        }
    ) {
        const db = dalFactory({
            caseReferenceNumber,
            logger,
            searchType,
            includeNamedQueries,
            queryDslConfig
        });
        return db.getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage, { sourceFields });
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
