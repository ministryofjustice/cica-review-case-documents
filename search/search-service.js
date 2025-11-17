'use strict';

import got from 'got';

function createSearchService({
    caseReferenceNumber,
    logger,
    session
}) {
    const searchApi = got.extend({
        prefixUrl: process.env.APP_API_URL,
        headers: {
            'on-behalf-of': caseReferenceNumber,
            'Cookie': `${session.cookieName}=${session.id}`
        },
        responseType: 'json',
        context: {
            logger
        }
    });

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
        logger.info({ query, pageNumber, itemsPerPage }, "Fetching search results");
        // Use the configured searchApi client
        return searchApi.get(`search/${query}/${pageNumber}/${itemsPerPage}`);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
