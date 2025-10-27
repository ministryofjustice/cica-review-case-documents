'use strict';

import createRequestService from '../service/request/index.js'

function createSearchService(options = {
}) {
    const {get} = createRequestService();

    async function getSearchResults(query, pageNumber, itemsPerPage) {
        const opts = {
            url: `${process.env.APP_API_URL}/search/${query}/${pageNumber}/${itemsPerPage}`,
            headers: {
                // Authorization: `Bearer ${process.env.CW_DCS_JWT}`,
                'On-Behalf-Of': options.caseReferenceNumber
            }
        };
        return get(opts);
    }

    return Object.freeze({
        getSearchResults
    });
}

export default createSearchService;
