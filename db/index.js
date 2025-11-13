import { Client as defaultClient } from '@opensearch-project/opensearch';
import VError from 'verror';

/**
 * @typedef {object} OpenSearchQuery
 * @property {string} index - The index to query.
 * @property {object} query - The OpenSearch query DSL object.
 */

/**
 * @typedef {object} OpenSearchResponse
 * @property {object} body - The raw response body.
 * @property {object} hits - The search results.
 * @property {object[]} [hits.hits] - The array of result documents.
 */

/**
 * A minimal interface for the OpenSearch client used by this service.
 * @typedef {object} OpenSearchClient
 * @property {(query: OpenSearchQuery) => Promise<OpenSearchResponse>} search
 *   Executes a search query and returns a promise resolving to the OpenSearch response.
 */

/**
 * @typedef {object} Logger
 * @property {(data: object, message?: string) => void} info - Logs informational messages with structured data.
 * @property {(data: object, message?: string) => void} error - Logs errors with structured data.
 */

/**
 * Factory function to create a database query service.
 *
 * This function wraps an OpenSearch client and provides a simplified query API.
 * It also measures and logs the execution time of queries if a logger is provided.
 *
 * @param {object} params - Configuration parameters.
 * @param {new (...args: any[]) => OpenSearchClient} [params.Client=defaultClient]
 *   The OpenSearch client constructor (used for dependency injection in testing or custom configuration).
 * @param {Logger} [params.logger] - Optional logger instance.
 *   If provided, query timing and metadata will be logged at the `info` level.
 *
 * @throws {VError} Throws if `APP_DATABASE_URL` is not defined in the environment.
 * @returns {{ query: (query: OpenSearchQuery) => Promise<OpenSearchResponse> }}
 *   A frozen object exposing a single `query` method to execute OpenSearch queries.
 */
function createDBQuery({ Client = defaultClient, logger }) {
    if (process.env.APP_DATABASE_URL === undefined) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            'Environment variable "APP_DATABASE_URL" must be set'
        );
    }

    const client = new Client({
        node: process.env.APP_DATABASE_URL
    });

    /**
     * Executes a query against the OpenSearch database and logs its execution time.
     *
     * @async
     * @param {OpenSearchQuery} query - The query object to pass to OpenSearch.
     * @returns {Promise<OpenSearchResponse>} The raw OpenSearch search response.
     * @throws {Error} If the underlying OpenSearch client throws an error.
     *
     * @example
     * const db = createDBQuery({ logger });
     * const results = await db.query({ index: 'my-index', query: { match_all: {} } });
     */
    async function query(query) {
        const processExecutionStart = process.hrtime();
        const results = await client.search(query);
        const processExecutionTime = process.hrtime(processExecutionStart);

        if (logger?.info) {
            const seconds = processExecutionTime[0];
            const nanoseconds = processExecutionTime[1];
            const milliseconds = nanoseconds / 1e6;
            logger.info(
                {
                    data: {
                        query,
                        rows: results.hits?.hits?.length ?? 0
                    },
                    executionTime: `${seconds}s ${milliseconds.toFixed(3)}ms`,
                    executionTimeNs: seconds * 1e9 + nanoseconds
                },
                'DB QUERY'
            );
        }

        return results;
    }

    return Object.freeze({
        query
    });
}

export default createDBQuery;
