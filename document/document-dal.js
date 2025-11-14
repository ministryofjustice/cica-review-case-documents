import VError from 'verror';
import createDBQueryDefault from '../db/index.js';

/**
 * @typedef {object} Logger
 * @property {(info: object, message?: string) => void} info
 *   Logs informational messages, typically structured objects with metadata.
 * @property {(error: object, message?: string) => void} [error]
 *   Optionally logs error messages for debugging or monitoring.
 *
 * The logger can be an instance of a structured logging tool such as `pino` or `pino-http`.
 * When provided, query execution time, row counts, and query metadata are logged automatically.
 */

/**
 * Creates a Data Access Layer (DAL) for document operations.
 *
 * The DAL serves as an abstraction over the OpenSearch database layer.
 * It provides methods for querying and retrieving documents and their associated chunks
 * while automatically handling pagination, query execution timing, and optional structured logging.
 *
 * @param {Object} params - Configuration parameters for the DAL.
 * @param {string} params.caseReferenceNumber
 *   Case reference number to scope searches.
 *   Must match the pattern `/^[0-9]{2}-[0-9]{6}$/`.
 *   - The first two characters are digits (`0–9`) - The 2-digit year the case was created.
 *   - Followed by a dash (`-`)
 *   - Followed by six digits (`0–9`) - The 6-digit ID for that case, for that year.
 *
 *   **Examples**
 *   - `"12-345678"`
 *   - `"00-000000"`
 *
 * @param {Function} [params.createDBQuery=createDBQueryDefault]
 *   Factory function used to create the database query interface.
 *   Can be replaced in tests for dependency injection or mocking.
 *
 * @param {Logger} [params.logger]
 *   Optional structured logger instance.
 *
 * @throws {VError} Throws a `ConfigurationError` if the environment variable
 *   `OPENSEARCH_INDEX_CHUNKS_NAME` is not defined.
 *
 * @returns {{
 *   getDocuments: () => Promise<object[]>,
 *   getDocument: (documentId: string) => Promise<object>,
 *   getDocumentsChunksByKeyword: (keyword: string, pageNumber: number, itemsPerPage: number) => Promise<object[]>
 * }}
 *   A frozen object exposing document and chunk retrieval methods.
 */
function createDocumentDAL({ caseReferenceNumber, createDBQuery = createDBQueryDefault, logger }) {
    if (process.env.OPENSEARCH_INDEX_CHUNKS_NAME === undefined) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            'Environment variable "OPENSEARCH_INDEX_CHUNKS_NAME" must be set'
        );
    }
    const db = createDBQuery({ logger });

    // TODO: implements documents retrieval.
    async function getDocuments() {
        return [];
    }

    // TODO: implements document retrieval.
    async function getDocument() {
        return [];
    }

    /**
     * Searches document chunks by keyword and paginates the results.
     *
     * @async
     * @param {string} keyword - Keyword to search in `chunk_text`.
     * @param {number} pageNumber - 1-based page number.
     * @param {number} itemsPerPage - Number of items per page.
     * @returns {Promise<Object[]>} Array of hit objects from OpenSearch.
     *
     * @throws {VError} If the OpenSearch query fails or throws an error.
     */
    async function getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage) {
        try {
            const queryBody = {
                from: itemsPerPage * (pageNumber - 1),
                size: itemsPerPage,
                query: {
                    bool: {
                        must: [
                            {
                                match: {
                                    'chunk_text': keyword
                                }
                            },
                            {
                                match: {
                                    case_ref: caseReferenceNumber
                                }
                            }
                        ]
                    }
                }
            };
            if (logger && typeof logger.info === 'function') {
                logger.info({
                    index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                    queryBody,
                    keyword,
                    caseReferenceNumber,
                    pageNumber,
                    itemsPerPage
                }, '[OpenSearch] Performing search');
            } else {
                console.info('[OpenSearch] Performing search:', {
                    index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                    queryBody,
                    keyword,
                    caseReferenceNumber,
                    pageNumber,
                    itemsPerPage
                });
            }
            const response = await db.query({
                index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                body: queryBody
            });
            const hits = response?.body?.hits?.hits || [];
            if (logger && typeof logger.info === 'function') {
                logger.info({ hitsCount: hits.length }, '[OpenSearch] Search response');
            } else {
                console.info(`[OpenSearch] Search response: ${hits.length} hits returned.`);
            }
            if (hits.length === 0) {
                if (logger && typeof logger.warn === 'function') {
                    logger.warn({ keyword, caseReferenceNumber }, '[OpenSearch] No results found for query');
                } else {
                    console.warn('[OpenSearch] No results found for query:', { keyword, caseReferenceNumber });
                }
            }
            return response?.body?.hits ?? [];
        } catch (err) {
            if (logger && typeof logger.error === 'function') {
                logger.error({ err }, '[OpenSearch] Search error');
            } else {
                console.error('[OpenSearch] Search error:', err);
            }
            throw new VError(err, `Failed to execute search query on index "${process.env.OPENSEARCH_INDEX_CHUNKS_NAME}"`);
        }
    }

    return Object.freeze({
        getDocuments,
        getDocument,
        getDocumentsChunksByKeyword
    });
}

export default createDocumentDAL;
