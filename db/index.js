'use strict';

import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.APP_DATABASE_URL
});

function createDBQuery() {
    async function query(query, params) {
        const results = await client.search(query);
        return results;
    }

    return Object.freeze({
        query
    });
}

export default createDBQuery;


