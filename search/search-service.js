import { DEFAULT_SEARCH_TYPE } from '../api/search/constants/searchTypes.js';
import createRequestServiceDefault from '../service/request/index.js';

/**
 * Creates a search service for fetching search results from the API.
 *
 * @param {Object} options - The options for creating the search service.
 * @param {string} options.caseReferenceNumber - The reference number for the case, used in request headers.
 * @param {Object} options.logger - Logger instance for logging actions.
 * @param {Function} [options.createRequestService=createRequestServiceDefault] - Factory function to create a request service.
 * @returns {Object} The search service with a method to fetch search results.
 */
function createSearchService({
    caseReferenceNumber,
    logger,
    createRequestService = createRequestServiceDefault
} = {}) {
    const { post } = createRequestService();

    /**
     * Fetches search results from the API.
     *
     * @async
     * @param {string} query - The search query string.
     * @param {number} pageNumber - The page number of results to fetch.
     * @param {number} itemsPerPage - Number of items per page.
     * @param {string} token - The authentication token.
     * @param {Object} [options] - Additional request options.
     * @param {string} [options.searchType=DEFAULT_SEARCH_TYPE] - Search mode (one of SEARCH_TYPES: keyword, keyword-dates, semantic, hybrid, hybrid-dates).
     * @param {boolean} [options.includeNamedQueries=false] - Whether API should include query `_name` metadata for matched query sources.
     * @param {object} [options.queryDslConfig] - Optional debug-only DSL tuning overrides.
     * @returns {Promise<object>} A promise that resolves to the search results.
     */
    async function getSearchResults(
        query,
        pageNumber,
        itemsPerPage,
        token,
        { searchType = DEFAULT_SEARCH_TYPE, includeNamedQueries = false, queryDslConfig } = {}
    ) {
        logger?.info?.({ query, pageNumber, itemsPerPage }, 'Fetching search results');
        const opts = {
            url: `${process.env.APP_API_URL}/search/`,
            json: {
                query: String(query),
                pageNumber: Number(pageNumber),
                itemsPerPage: Number(itemsPerPage),
                type: searchType
            },
            headers: {
                'On-Behalf-Of': caseReferenceNumber
            }
        };
        if (token) {
            // Include Authorization header if token is provided
            opts.headers.Authorization = `Bearer ${token}`;
        }
        // Enable debug context when either includeNamedQueries is requested
        // or when queryDslConfig is provided (DSL tuning requires debug context).
        const hasQueryDslConfig = queryDslConfig && Object.keys(queryDslConfig).length > 0;
        if (includeNamedQueries === true || hasQueryDslConfig) {
            opts.headers['X-Debug-Context'] = 'true';
        }
        // Only send DSL config header when non-empty and debug context is enabled.
        if (hasQueryDslConfig) {
            opts.headers['X-Query-DSL-Config'] = JSON.stringify(queryDslConfig);
        }
        return post(opts);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
