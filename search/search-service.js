'use strict';

import createRequestServiceDefault from '../service/request/index.js'

function createSearchService({
    caseReferenceNumber,
    logger,
    createRequestService = createRequestServiceDefault
} = {}) {
    const {get} = createRequestService();

    /**
     * Fetches search results from the API.
     *
     * @async
     * @param {string} query - The search query string.
     * @param {number} pageNumber - The page number of results to fetch.
     * @param {number} itemsPerPage - Number of items per page.
     * @returns {Promise<object>} A promise that resolves to the search results.
     */
    async function getSearchResults(query, pageNumber, itemsPerPage) {
        logger.info({ query, pageNumber, itemsPerPage });
        const opts = {
            url: `${process.env.APP_API_URL}/search/${query}/${pageNumber}/${itemsPerPage}`,
            headers: {
                'On-Behalf-Of': caseReferenceNumber
            }
        };
        return get(opts);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
