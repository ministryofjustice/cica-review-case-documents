import crypto from 'node:crypto';
import { Client as defaultClient } from '@opensearch-project/opensearch';
import VError from 'verror';

/**
 *  Module-scoped client cache so OpenSearch TCP connections are reused across requests.
 *
 * @type {WeakMap<Function, Map<string, OpenSearchClient>>}
 */
const clientByConstructorAndNode = new WeakMap();
/**
 * Default threshold for slow query warnings in milliseconds.
 *
 * @type {number}
 */
const DEFAULT_SLOW_QUERY_WARN_MS = 2000;

/**
 * Hashes node URL for safe logging without exposing credentials.
 *
 * @param {string} node - OpenSearch node URL to hash for log-safe metadata.
 * @returns {string}
 */
function nodeHash(node) {
    return crypto.createHash('sha256').update(node).digest('hex').slice(0, 8);
}

/**
 * Returns a shared OpenSearch client instance for the provided constructor+node pair.
 *
 * @param {new (...args: any[]) => OpenSearchClient} Client - OpenSearch client constructor to instantiate when no cached client exists.
 * @param {string} node - OpenSearch node URL used as the cache key and client connection target.
 * @param {Logger} [logger] - Optional logger used to record client creation/reuse events.
 * @returns {OpenSearchClient}
 */
function getOrCreateSharedClient(Client, node, logger) {
    let clientsByNode = clientByConstructorAndNode.get(Client);
    if (!clientsByNode) {
        clientsByNode = new Map();
        clientByConstructorAndNode.set(Client, clientsByNode);
    }

    let client = clientsByNode.get(node);
    if (!client) {
        client = new Client({ node });
        clientsByNode.set(node, client);
        logger?.debug?.(
            {
                clientType: Client.name || 'anonymous-client',
                nodeHash: nodeHash(node)
            },
            'OpenSearch client created'
        );
    } else {
        logger?.debug?.(
            {
                clientType: Client.name || 'anonymous-client',
                nodeHash: nodeHash(node)
            },
            'OpenSearch client reused'
        );
    }

    return client;
}

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
 * @property {(data: object, message?: string) => void} [warn] - Logs warning messages with structured data.
 * @property {(data: object, message?: string) => void} [debug] - Logs debug messages with structured data.
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

    const client = getOrCreateSharedClient(Client, process.env.APP_DATABASE_URL, logger);
    const slowQueryWarnMs = Number.parseInt(
        process.env.DB_SLOW_QUERY_WARN_MS ?? `${DEFAULT_SLOW_QUERY_WARN_MS}`,
        10
    );

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
        const seconds = processExecutionTime[0];
        const nanoseconds = processExecutionTime[1];
        const executionTimeMs = seconds * 1e3 + nanoseconds / 1e6;
        const rows = results?.body?.hits?.hits?.length ?? results?.hits?.hits?.length ?? 0;

        if (logger?.info) {
            logger.info(
                {
                    data: {
                        query,
                        rows
                    },
                    executionTime: `${seconds}s ${(nanoseconds / 1e6).toFixed(3)}ms`,
                    executionTimeMs,
                    executionTimeNs: seconds * 1e9 + nanoseconds
                },
                'DB QUERY'
            );
        }

        if (
            logger?.warn &&
            Number.isFinite(slowQueryWarnMs) &&
            executionTimeMs >= slowQueryWarnMs
        ) {
            logger.warn(
                {
                    index: query?.index,
                    executionTimeMs,
                    slowQueryWarnMs,
                    rows
                },
                'DB QUERY SLOW'
            );
        }

        return results;
    }

    return Object.freeze({
        query
    });
}

export default createDBQuery;
