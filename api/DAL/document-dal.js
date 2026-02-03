import VError from 'verror';
import createDBQueryDefault from '../../db/index.js';

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
 *   Must match the pattern `/^\d{2}-[78]\d{5}$/`.
 *   Format: YY-7NNNNN or YY-8NNNNN (e.g. 26-711111, 36-873423)
 *   - YY: 2-digit year the case was created (e.g. 26 for 2026)
 *   - 7: Personal Injury cases | 8: Bereavement cases
 *   - NNNNN: 5-digit case ID for that year
 *
 *   **Examples**
 *   - `"12-745678"`
 *   - `"00-800000"`
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
    /**
     * Retrieves a list of documents.
     * @returns {Promise<Array>} A promise that resolves to an array of documents.
     */
    async function getDocuments() {
        return [];
    }

    // TODO: implements document retrieval.
    /**
     * Asynchronously retrieves a list of documents.
     * @returns {Promise<Array>} A promise that resolves to an array of documents.
     */
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
                            { match: { chunk_text: keyword } },
                            { match: { case_ref: caseReferenceNumber } }
                        ]
                    }
                }
            };

            logger.info(
                {
                    index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                    queryBody,
                    keyword,
                    caseReferenceNumber,
                    pageNumber,
                    itemsPerPage
                },
                'OpenSearch Performing search'
            );

            const response = await db.query({
                index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                body: queryBody
            });
            const hits = response?.body?.hits ?? {};

            logger.info({ hitsCount: hits?.hits?.length ?? 0 }, 'OpenSearch Search response');

            if (hits?.hits?.length === 0) {
                logger?.warn?.(
                    { keyword, caseReferenceNumber },
                    '[OpenSearch] No results found for query'
                );
            }
            return hits;
        } catch (err) {
            logger?.error?.({ err }, '[OpenSearch] Search error');
            throw new VError(
                err,
                `Failed to execute search query on index "${process.env.OPENSEARCH_INDEX_CHUNKS_NAME}"`
            );
        }
    }

    /**
     * Retrieves page metadata from the page_metadata index by document ID and page number.
     *
     * @async
     * @param {string} documentId - The UUID of the document (source_doc_id in OpenSearch).
     * @param {number|string} pageNumber - The page number (page_num in OpenSearch).
     * @returns {Promise<Object|null>} The page metadata object with all fields, or null if not found.
     * @throws {VError} If the database query fails.
     */
    async function getPageMetadataByDocumentIdAndPageNumber(documentId, pageNumber) {
        try {
            logger?.info?.({ documentId, pageNumber }, 'Querying OpenSearch for page metadata');

            const response = await db.query({
                index: 'page_metadata',
                body: {
                    query: {
                        bool: {
                            must: [
                                { match: { source_doc_id: documentId } },
                                { match: { page_num: parseInt(pageNumber, 10) } }
                            ]
                        }
                    },
                    _source: [
                        'source_doc_id',
                        'page_num',
                        'page_count',
                        'page_id',
                        's3_page_image_s3_uri',
                        'text',
                        'correspondence_type'
                    ]
                }
            });

            if (response.body?.hits?.hits && response.body.hits.hits.length > 0) {
                const hit = response.body.hits.hits[0];
                logger?.info?.({ documentId, pageNumber, pageId: hit._id }, 'Page metadata found');
                return hit._source;
            }

            logger?.info?.({ documentId, pageNumber }, 'Page metadata not found');
            return null;
        } catch (err) {
            logger?.error?.({ err, documentId, pageNumber }, 'Failed to query page metadata');
            throw new VError(
                err,
                `Failed to query page metadata for document "${documentId}" page "${pageNumber}"`
            );
        }
    }

    /**
     * Retrieves all chunks for a specific document page, filtered by document ID, page number and search term.
     * Returns only the bounding box and chunk text data for each chunk to support overlay rendering.
     *
     * @async
     * @param {string} documentId - The UUID of the document (source_doc_id in OpenSearch).
     * @param {number|string} pageNumber - The page number.
     * @param {string} [searchTerm] - Search term to filter chunks by content.
     * @returns {Promise<Array<Object>>} Array of chunk objects containing only bounding_box data.
     * @throws {VError} If the database query fails.
     */
    async function getPageChunksByDocumentIdAndPageNumber(documentId, pageNumber, searchTerm) {
        try {
            logger?.info?.(
                { documentId, pageNumber, searchTerm },
                'Querying OpenSearch for page chunks with bounding boxes'
            );

            const mustQuery = [
                { match: { source_doc_id: documentId } },
                { match: { page_number: parseInt(pageNumber, 10) } },
                { match: { case_ref: caseReferenceNumber } }
            ];

            if (searchTerm) {
                mustQuery.push({ match: { chunk_text: searchTerm } });
            }

            const queryBody = {
                query: {
                    bool: {
                        must: mustQuery
                    }
                },
                _source: ['chunk_id', 'bounding_box', 'chunk_type', 'chunk_index', 'chunk_text'],
                sort: [{ chunk_index: { order: 'asc' } }]
            };

            const response = await db.query({
                index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME,
                body: queryBody
            });

            const hits = response?.body?.hits?.hits || [];

            logger?.info?.(
                { documentId, pageNumber, chunksCount: hits.length, searchTerm },
                'Retrieved page chunks'
            );

            if (hits.length === 0) {
                logger?.warn?.(
                    { documentId, pageNumber, caseReferenceNumber, searchTerm },
                    'No chunks found for document page'
                );
            }

            return hits.map((hit) => hit._source);
        } catch (err) {
            logger?.error?.({ err, documentId, pageNumber }, 'Failed to query page chunks');
            throw new VError(
                err,
                `Failed to query page chunks for document "${documentId}" page "${pageNumber}"`
            );
        }
    }

    return Object.freeze({
        getDocuments,
        getDocument,
        getDocumentsChunksByKeyword,
        getPageMetadataByDocumentIdAndPageNumber,
        getPageChunksByDocumentIdAndPageNumber
    });
}

export default createDocumentDAL;
