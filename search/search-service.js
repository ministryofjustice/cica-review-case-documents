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
     * @param {boolean} [options.useKeyword=true] - Enable lexical (BM25) keyword matching.
     * @param {boolean} [options.useSemantic=false] - Enable neural (vector) semantic matching.
     * @param {boolean} [options.useDates=true] - Enable date extraction and variant expansion.
     * @returns {Promise<object>} A promise that resolves to the search results.
     */
    async function getSearchResults(
        query,
        pageNumber,
        itemsPerPage,
        token,
        { useKeyword = true, useSemantic = false, useDates = true } = {}
    ) {
        logger.info({ query, pageNumber, itemsPerPage }, 'Fetching search results');
        const flag = (val) => (val ? 'on' : 'off');
        const opts = {
            url:
                `${process.env.APP_API_URL}/search/?query=${query}` +
                `&pageNumber=${pageNumber}&itemsPerPage=${itemsPerPage}` +
                `&keyword=${flag(useKeyword)}&semantic=${flag(useSemantic)}&dates=${flag(useDates)}`,
            headers: {
                'On-Behalf-Of': caseReferenceNumber
            }
        };
        if (token) {
            // Include Authorization header if token is provided
            opts.headers.Authorization = `Bearer ${token}`;
        }
        return get(opts);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
