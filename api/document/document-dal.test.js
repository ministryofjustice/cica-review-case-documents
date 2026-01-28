import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import VError from 'verror';
import createDocumentDAL from './document-dal.js';

const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {}
};

describe('document-dal', () => {
    const ENV_ORIGINAL = {
        ...process.env,
        OPENSEARCH_INDEX_CHUNKS_NAME: 'test-idex'
    };
    const CREATE_DB_QUERY_INSTANCE = {
        SUCCESS: {
            query: async () => {
                return {
                    body: {
                        hits: [
                            { _id: 'doc1', _source: { chunk_text: 'foo', case_ref: '12-345678' } }
                        ]
                    }
                };
            }
        },
        FAILURE: {
            query: async () => {
                throw new Error('db failure');
            }
        },
        EMPTY: {
            query: async () => {
                return {
                    body: {
                        hits: []
                    }
                };
            }
        }
    };
    beforeEach(() => {
        process.env = { ...ENV_ORIGINAL };
    });

    it('Should throw if OPENSEARCH_INDEX_CHUNKS_NAME is not set', () => {
        delete process.env.OPENSEARCH_INDEX_CHUNKS_NAME;
        assert.throws(
            () =>
                createDocumentDAL({
                    caseReferenceNumber: '12-345678',
                    createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS
                }),
            (err) =>
                err.name === 'ConfigurationError' &&
                /Environment variable "OPENSEARCH_INDEX_CHUNKS_NAME" must be set/.test(err.message)
        );
    });

    it('Should return body.hits from DB response', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS,
            logger: mockLogger
        });

        const results = await dal.getDocumentsChunksByKeyword('foo', 1, 10);

        assert.equal(results.length, 1);
        assert.equal(results[0]._id, 'doc1');
        assert.equal(results[0]._source.chunk_text, 'foo');
    });

    it('Should rethrow if an error if db.query throws', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.FAILURE,
            logger: mockLogger
        });

        await assert.rejects(
            () => dal.getDocumentsChunksByKeyword('foo', 1, 10),
            (err) => err instanceof VError && /Failed to execute search query/.test(err.message)
        );
    });

    it('Should return an empty array if response has no hits', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.EMPTY,
            logger: mockLogger
        });

        const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);
        assert.deepEqual(result, []);
    });

    describe('getPageMetadataByDocumentIdAndPageNumber', () => {
        it('should return page metadata when found', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: [
                                {
                                    _id: 'page1',
                                    _source: {
                                        source_doc_id: 'doc-123',
                                        page_num: 5,
                                        s3_page_image_s3_uri: 's3://bucket/image.png',
                                        page_width: 800,
                                        page_height: 1200,
                                        page_count: 10
                                    }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 5);

            assert.ok(result);
            assert.strictEqual(result.source_doc_id, 'doc-123');
            assert.strictEqual(result.page_num, 5);
            assert.strictEqual(result.s3_page_image_s3_uri, 's3://bucket/image.png');
        });

        it('should return null when page not found', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: []
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 999);

            assert.strictEqual(result, null);
        });

        it('should throw VError when query fails', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('Database connection failed');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await assert.rejects(
                () => dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 1),
                (err) => err instanceof VError && /Failed to query page metadata/.test(err.message)
            );
        });

        it('should handle string page numbers', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return {
                        body: {
                            hits: {
                                hits: [
                                    {
                                        _id: 'page1',
                                        _source: { page_num: 5 }
                                    }
                                ]
                            }
                        }
                    };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', '5');

            assert.strictEqual(queryArgs.index, 'page_metadata');
            assert.deepStrictEqual(queryArgs.body.query.bool.must[1], { match: { page_num: 5 } });
        });
    });

    describe('Logging fallbacks', () => {
        it('should handle missing logger in getPageMetadataByDocumentIdAndPageNumber', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: [
                                {
                                    _id: 'page1',
                                    _source: { page_num: 1 }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: null
            });

            const result = await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 1);
            assert.ok(result);
        });

        it('should handle logger without error method in getPageMetadataByDocumentIdAndPageNumber', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('DB error');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-345678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} } // Logger without error method
            });

            await assert.rejects(
                () => dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 1),
                (err) => err instanceof VError
            );
        });
    });
});
