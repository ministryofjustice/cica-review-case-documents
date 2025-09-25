'use strict';

function createDBQuery() {
    async function query(text, params) {
        const results = await openSearch.query(text, params);
        return results;
    }

    return Object.freeze({
        query
    });
}

export default createDBQuery;
