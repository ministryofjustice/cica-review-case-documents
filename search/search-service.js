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
    const { get } = createRequestService();

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
     * @returns {Promise<object>} A promise that resolves to the search results.
     */
    async function getSearchResults(
        query,
        pageNumber,
        itemsPerPage,
        token,
        { searchType = DEFAULT_SEARCH_TYPE, includeNamedQueries = false } = {}
    ) {
        logger.info({ query, pageNumber, itemsPerPage }, 'Fetching search results');
        const searchParams = new URLSearchParams({
            query: String(query),
            pageNumber: String(pageNumber),
            itemsPerPage: String(itemsPerPage),
            type: searchType
        });
        const strictQueryString = Array.from(searchParams.entries())
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        const opts = {
            url: `${process.env.APP_API_URL}/search/?${strictQueryString}`,
            headers: {
                'On-Behalf-Of': caseReferenceNumber
            }
        };
        if (token) {
            // Include Authorization header if token is provided
            opts.headers.Authorization = `Bearer ${token}`;
        }
        // enables inclusion of query metadata in API response for
        // debugging purposes when debug context is active.
        if (includeNamedQueries === true) {
            opts.headers['X-Debug-Context'] = 'true';
        }
        return get(opts);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
