import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import createPageChunksService from './page-chunks-service.js';

const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {}
};

describe('page-chunks-service', () => {
    let pageChunksService;
    let mockDAL;

    beforeEach(() => {
        mockDAL = {
            getPageChunksByDocumentIdAndPageNumber: async () => {
                return [
                    {
                        chunk_id: 'chunk-1',
                        chunk_type: 'LAYOUT_HEADER',
                        chunk_index: 0,
                        bounding_box: { left: 0.1, top: 0.1, width: 0.8, height: 0.15 },
                        chunk_text: 'Header text'
                    }
                ];
            }
        };

        pageChunksService = createPageChunksService({
            createDocumentDAL: () => mockDAL
        });
    });

    describe('getPageChunks', () => {
        it('should return chunks for valid parameters', async () => {
            const documentId = 'doc-123';
            const pageNumber = 1;
            const crn = '12-745678';
            const searchTerm = 'test';

            const result = await pageChunksService.getPageChunks(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                { logger: mockLogger }
            );

            assert.strictEqual(Array.isArray(result), true);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].chunk_id, 'chunk-1');
        });

        it('should pass documentId to DAL method', async () => {
            let capturedDocumentId;
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async (docId) => {
                capturedDocumentId = docId;
                return [];
            };

            await pageChunksService.getPageChunks('doc-456', 1, '12-745678', 'term', {
                logger: mockLogger
            });

            assert.strictEqual(capturedDocumentId, 'doc-456');
        });

        it('should pass pageNumber to DAL method', async () => {
            let capturedPageNumber;
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async (_, pageNum) => {
                capturedPageNumber = pageNum;
                return [];
            };

            await pageChunksService.getPageChunks('doc-123', 5, '12-745678', 'term', {
                logger: mockLogger
            });

            assert.strictEqual(capturedPageNumber, 5);
        });

        it('should pass searchTerm to DAL method', async () => {
            let capturedSearchTerm;
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async (_, __, searchTerm) => {
                capturedSearchTerm = searchTerm;
                return [];
            };

            await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'keyword', {
                logger: mockLogger
            });

            assert.strictEqual(capturedSearchTerm, 'keyword');
        });

        it('should handle DAL errors and throw with status code', async () => {
            const dalError = new Error('OpenSearch connection failed');
            dalError.status = 503;
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                throw dalError;
            };

            let thrownError;
            try {
                await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'term', {
                    logger: mockLogger
                });
            } catch (err) {
                thrownError = err;
            }

            assert.strictEqual(thrownError.message, 'OpenSearch connection failed');
            assert.strictEqual(thrownError.status, 503);
        });

        it('should use error statusCode if status is not available', async () => {
            const dalError = new Error('Query error');
            dalError.statusCode = 400;
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                throw dalError;
            };

            let thrownError;
            try {
                await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'term', {
                    logger: mockLogger
                });
            } catch (err) {
                thrownError = err;
            }

            assert.strictEqual(thrownError.status, 400);
        });

        it('should default to 500 status if error has no status code', async () => {
            const dalError = new Error('Unknown error');
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                throw dalError;
            };

            let thrownError;
            try {
                await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'term', {
                    logger: mockLogger
                });
            } catch (err) {
                thrownError = err;
            }

            assert.strictEqual(thrownError.status, 500);
        });

        it('should log errors when logger is provided', async () => {
            let loggedError;
            const testLogger = {
                error: (obj) => {
                    loggedError = obj;
                }
            };

            const dalError = new Error('Test error');
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                throw dalError;
            };

            try {
                await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'term', {
                    logger: testLogger
                });
            } catch {
                // Expected
            }

            assert.strictEqual(typeof loggedError, 'object');
            assert.strictEqual(loggedError.error, 'Test error');
        });

        it('should work without logger provided', async () => {
            await pageChunksService.getPageChunks('doc-123', 1, '12-745678', 'term');

            // Should not throw
            assert.strictEqual(true, true);
        });

        it('should return empty array if DAL returns empty chunks', async () => {
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                return [];
            };

            const result = await pageChunksService.getPageChunks(
                'doc-123',
                1,
                '12-745678',
                'term',
                { logger: mockLogger }
            );

            assert.strictEqual(result.length, 0);
        });

        it('should return multiple chunks', async () => {
            mockDAL.getPageChunksByDocumentIdAndPageNumber = async () => {
                return [
                    {
                        chunk_id: 'chunk-1',
                        chunk_type: 'LAYOUT_HEADER',
                        chunk_index: 0,
                        bounding_box: { left: 0.1, top: 0.1, width: 0.8, height: 0.15 },
                        chunk_text: 'Header'
                    },
                    {
                        chunk_id: 'chunk-2',
                        chunk_type: 'TEXT',
                        chunk_index: 1,
                        bounding_box: { left: 0.1, top: 0.3, width: 0.8, height: 0.5 },
                        chunk_text: 'Body text'
                    }
                ];
            };

            const result = await pageChunksService.getPageChunks(
                'doc-123',
                1,
                '12-745678',
                'term',
                { logger: mockLogger }
            );

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].chunk_id, 'chunk-1');
            assert.strictEqual(result[1].chunk_id, 'chunk-2');
        });
    });

    describe('factory and freezing', () => {
        it('should return a frozen object', () => {
            const service = createPageChunksService();
            assert.strictEqual(Object.isFrozen(service), true);
        });

        it('should expose getPageChunks method', () => {
            const service = createPageChunksService();
            assert.strictEqual(typeof service.getPageChunks, 'function');
        });
    });
});
