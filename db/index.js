'use strict';

import { Client } from '@opensearch-project/opensearch';

const host = "localhost";
const protocol = "http";
const port = 9200;

const client = new Client({
  node: protocol + "://" + host + ":" + port
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


