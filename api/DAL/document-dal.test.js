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
                            { _id: 'doc1', _source: { chunk_text: 'foo', case_ref: '12-745678' } }
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

    describe('getDocuments', () => {
        it('should return empty array', async () => {
            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS,
                logger: mockLogger
            });

            const result = await dal.getDocuments();

            assert.deepStrictEqual(result, []);
        });
    });

    describe('getDocument', () => {
        it('should return empty array', async () => {
            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS,
                logger: mockLogger
            });

            const result = await dal.getDocument();

            assert.deepStrictEqual(result, []);
        });
    });

    it('Should throw if OPENSEARCH_INDEX_CHUNKS_NAME is not set', () => {
        delete process.env.OPENSEARCH_INDEX_CHUNKS_NAME;
        assert.throws(
            () =>
                createDocumentDAL({
                    caseReferenceNumber: '12-745678',
                    createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS
                }),
            (err) =>
                err.name === 'ConfigurationError' &&
                /Environment variable "OPENSEARCH_INDEX_CHUNKS_NAME" must be set/.test(err.message)
        );
    });

    it('Should return body.hits from DB response', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-745678',
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
            caseReferenceNumber: '12-745678',
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
            caseReferenceNumber: '12-745678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.EMPTY,
            logger: mockLogger
        });

        const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);
        assert.deepEqual(result, []);
    });

    it('Should call warn when OpenSearch returns zero hits in hits.hits', async () => {
        const mockDB = {
            query: async () => ({
                body: {
                    hits: {
                        hits: []
                    }
                }
            })
        };

        const warnCalls = [];
        const logger = {
            info: () => {},
            error: () => {},
            warn: (context, message) => warnCalls.push({ context, message })
        };

        const dal = createDocumentDAL({
            caseReferenceNumber: '12-745678',
            createDBQuery: () => mockDB,
            logger
        });

        const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);

        assert.deepStrictEqual(result, { hits: [] });
        assert.strictEqual(warnCalls.length, 1);
        assert.strictEqual(warnCalls[0].message, '[OpenSearch] No results found for query');
        assert.strictEqual(warnCalls[0].context.keyword, 'keyword');
        assert.strictEqual(warnCalls[0].context.caseReferenceNumber, '12-745678');
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
                                        correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST',
                                        page_count: 10,
                                        page_num: 5,
                                        s3_page_image_s3_uri: 's3://bucket/image.png',
                                        text: '28-Nov-2022 Gabapentin 600mg tablets'
                                    }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 5);

            assert.ok(result);
            assert.strictEqual(result.correspondence_type, 'TC19 - ADDITIONAL INFO REQUEST');
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
                caseReferenceNumber: '12-745678',
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
                caseReferenceNumber: '12-745678',
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
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', '5');

            assert.strictEqual(queryArgs.index, 'page_metadata');
            assert.deepStrictEqual(queryArgs.body.query.bool.must[1], { match: { page_num: 5 } });
        });
    });

    describe('Logging fallbacks', () => {
        it('should handle missing logger in getDocumentsChunksByKeyword - warn fallback', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: []
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {}, warn: () => {} } // Provide info and warn methods
            });

            const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);
            assert.deepEqual(result, []);
        });

        it('should handle logger without warn method in getDocumentsChunksByKeyword', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: []
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} } // Logger without warn method
            });

            const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);
            assert.deepEqual(result, []);
        });

        it('should handle missing logger in getDocumentsChunksByKeyword - error fallback', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('DB error');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { error: () => {} }
            });

            await assert.rejects(
                () => dal.getDocumentsChunksByKeyword('keyword', 1, 10),
                (err) => err instanceof VError
            );
        });

        it('should handle logger without error method in getDocumentsChunksByKeyword', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('DB error');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} } // Logger without error method
            });

            await assert.rejects(
                () => dal.getDocumentsChunksByKeyword('keyword', 1, 10),
                (err) => err instanceof VError
            );
        });

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
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {}, error: () => {} }
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
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} } // Logger without error method
            });

            await assert.rejects(
                () => dal.getPageMetadataByDocumentIdAndPageNumber('doc-123', 1),
                (err) => err instanceof VError
            );
        });
    });

    describe('getPageChunksByDocumentIdAndPageNumber', () => {
        it('should return page chunks with bounding boxes', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: [
                                {
                                    _id: 'chunk1',
                                    _source: {
                                        chunk_id: 'chunk-1',
                                        chunk_type: 'LAYOUT_HEADER',
                                        chunk_index: 0,
                                        bounding_box: {
                                            left: 0.1,
                                            top: 0.1,
                                            width: 0.8,
                                            height: 0.15
                                        },
                                        chunk_text: 'Header text'
                                    }
                                },
                                {
                                    _id: 'chunk2',
                                    _source: {
                                        chunk_id: 'chunk-2',
                                        chunk_type: 'TEXT',
                                        chunk_index: 1,
                                        bounding_box: {
                                            left: 0.1,
                                            top: 0.3,
                                            width: 0.8,
                                            height: 0.5
                                        },
                                        chunk_text: 'Body text'
                                    }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].chunk_id, 'chunk-1');
            assert.strictEqual(result[0].chunk_type, 'LAYOUT_HEADER');
            assert.deepStrictEqual(result[0].bounding_box, {
                left: 0.1,
                top: 0.1,
                width: 0.8,
                height: 0.15
            });
            assert.strictEqual(result[1].chunk_id, 'chunk-2');
        });

        it('should filter chunks by search term', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return {
                        body: {
                            hits: {
                                hits: [
                                    {
                                        _id: 'chunk1',
                                        _source: {
                                            chunk_id: 'chunk-1',
                                            chunk_type: 'TEXT',
                                            chunk_index: 0,
                                            bounding_box: { left: 0, top: 0, width: 1, height: 1 },
                                            chunk_text: 'matching text'
                                        }
                                    }
                                ]
                            }
                        }
                    };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1, 'search term');

            assert.ok(
                queryArgs.body.query.bool.must.some(
                    (clause) => clause.match?.chunk_text === 'search term'
                )
            );
        });

        it('should not filter by search term when searchTerm is empty string', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return {
                        body: {
                            hits: {
                                hits: []
                            }
                        }
                    };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1, '');

            const mustClauses = queryArgs.body.query.bool.must;
            assert.strictEqual(
                mustClauses.some((clause) => clause.match?.chunk_text),
                false
            );
        });

        it('should include source doc id filter in query', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-456', 1);

            assert.ok(
                queryArgs.body.query.bool.must.some(
                    (clause) => clause.match?.source_doc_id === 'doc-456'
                )
            );
        });

        it('should include page number filter in query', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', '5');

            assert.ok(
                queryArgs.body.query.bool.must.some((clause) => clause.match?.page_number === 5)
            );
        });

        it('should include case reference number filter in query', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.ok(
                queryArgs.body.query.bool.must.some(
                    (clause) => clause.match?.case_ref === '12-745678'
                )
            );
        });

        it('should include searchTerm filter', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1, 'needle');

            assert.ok(
                queryArgs.body.query.bool.must.some(
                    (clause) => clause.match?.chunk_text === 'needle'
                )
            );
        });

        it('should return empty array when no chunks found', async () => {
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
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 999);

            assert.deepStrictEqual(result, []);
        });

        it('should throw VError when query fails', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('Database connection failed');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await assert.rejects(
                () => dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1),
                (err) => err instanceof VError && /Failed to query page chunks/.test(err.message)
            );
        });

        it('should map chunk fields correctly', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: [
                                {
                                    _id: 'chunk1',
                                    _source: {
                                        chunk_id: 'id-123',
                                        chunk_type: 'TABLE',
                                        chunk_index: 2,
                                        bounding_box: {
                                            left: 0.2,
                                            top: 0.3,
                                            width: 0.6,
                                            height: 0.4
                                        },
                                        chunk_text: 'table content'
                                    }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.strictEqual(result[0].chunk_id, 'id-123');
            assert.strictEqual(result[0].chunk_type, 'TABLE');
            assert.strictEqual(result[0].chunk_index, 2);
            assert.strictEqual(result[0].chunk_text, 'table content');
            assert.deepStrictEqual(result[0].bounding_box, {
                left: 0.2,
                top: 0.3,
                width: 0.6,
                height: 0.4
            });
        });

        it('should handle chunks with missing optional fields', async () => {
            const mockDB = {
                query: async () => ({
                    body: {
                        hits: {
                            hits: [
                                {
                                    _id: 'chunk1',
                                    _source: {
                                        chunk_id: 'id-123',
                                        bounding_box: { left: 0, top: 0, width: 1, height: 1 }
                                        // Missing chunk_type, chunk_index, chunk_text
                                    }
                                }
                            ]
                        }
                    }
                })
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            const result = await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.strictEqual(result[0].chunk_id, 'id-123');
            assert.strictEqual(result[0].chunk_type, undefined);
            assert.strictEqual(result[0].chunk_index, undefined);
            assert.strictEqual(result[0].chunk_text, undefined);
        });

        it('should sort chunks by chunk_index ascending', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.deepStrictEqual(queryArgs.body.sort, [{ chunk_index: { order: 'asc' } }]);
        });

        it('should only request specific source fields', async () => {
            let queryArgs;
            const mockDB = {
                query: async (args) => {
                    queryArgs = args;
                    return { body: { hits: { hits: [] } } };
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: mockLogger
            });

            await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);

            assert.deepStrictEqual(queryArgs.body._source, [
                'chunk_id',
                'bounding_box',
                'chunk_type',
                'chunk_index',
                'chunk_text'
            ]);
        });

        it('should handle missing logger in getPageChunksByDocumentIdAndPageNumber', async () => {
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
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} }
            });

            const result = await dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1);
            assert.deepEqual(result, []);
        });

        it('should handle logger without error method in getPageChunksByDocumentIdAndPageNumber', async () => {
            const mockDB = {
                query: async () => {
                    throw new Error('DB error');
                }
            };

            const dal = createDocumentDAL({
                caseReferenceNumber: '12-745678',
                createDBQuery: () => mockDB,
                logger: { info: () => {} } // Logger without error method
            });

            await assert.rejects(
                () => dal.getPageChunksByDocumentIdAndPageNumber('doc-123', 1),
                (err) => err instanceof VError
            );
        });
    });
});
