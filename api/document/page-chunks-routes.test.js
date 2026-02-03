import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import createPageChunksRouter from './page-chunks-routes.js';

const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {}
};

describe('page-chunks-routes', () => {
    let router;
    let mockPageChunksService;
    let mockRequest;
    let mockResponse;
    let _nextCalled;
    let _nextError;

    beforeEach(() => {
        _nextCalled = false;
        _nextError = null;

        mockPageChunksService = {
            getPageChunks: async () => {
                return [
                    {
                        chunk_id: 'chunk-1',
                        chunk_type: 'LAYOUT_HEADER',
                        chunk_index: 0,
                        bounding_box: { left: 0.1, top: 0.1, width: 0.8, height: 0.15 },
                        chunk_text: 'Header'
                    }
                ];
            }
        };

        router = createPageChunksRouter({
            createPageChunksService: () => mockPageChunksService
        });

        mockRequest = {
            params: {
                documentId: 'doc-123',
                pageNumber: '1'
            },
            query: {
                crn: '12-745678',
                searchTerm: 'test'
            },
            log: mockLogger
        };

        mockResponse = {
            json: function (data) {
                this.jsonData = data;
                return this;
            }
        };
    });

    describe('GET /:documentId/page/:pageNumber/chunks', () => {
        it('should return chunks with proper JSON API format', async () => {
            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(mockResponse.jsonData.data.type, 'page-chunks');
            assert.strictEqual(mockResponse.jsonData.data.id, 'doc-123-1');
            assert.strictEqual(Array.isArray(mockResponse.jsonData.data.attributes.chunks), true);
        });

        it('should require crn parameter', async () => {
            mockRequest.query.crn = undefined;
            const handler = router.stack[0].route.stack[0].handle;

            let errorThrown;
            try {
                await handler(mockRequest, mockResponse, (err) => {
                    errorThrown = err;
                });
            } catch (err) {
                errorThrown = err;
            }

            assert.strictEqual(errorThrown.message, 'Case reference number (crn) is required');
            assert.strictEqual(errorThrown.status, 400);
        });

        it('should validate crn format', async () => {
            mockRequest.query.crn = 'invalid-format';
            const handler = router.stack[0].route.stack[0].handle;

            let errorThrown;
            try {
                await handler(mockRequest, mockResponse, (err) => {
                    errorThrown = err;
                });
            } catch (err) {
                errorThrown = err;
            }

            assert.strictEqual(errorThrown.message, 'Invalid case reference number');
            assert.strictEqual(errorThrown.status, 400);
        });

        it('should accept valid crn formats', async () => {
            mockRequest.query.crn = '12-745678';
            const handler = router.stack[0].route.stack[0].handle;

            // Should not throw
            let errorThrown = false;
            try {
                await handler(mockRequest, mockResponse, (err) => {
                    if (err) errorThrown = true;
                });
            } catch {
                errorThrown = true;
            }

            assert.strictEqual(errorThrown, false);
        });

        it('should accept alternative crn format with digit 7', async () => {
            mockRequest.query.crn = '12-745678';
            const handler = router.stack[0].route.stack[0].handle;

            let errorThrown = false;
            try {
                await handler(mockRequest, mockResponse, (err) => {
                    if (err) errorThrown = true;
                });
            } catch {
                errorThrown = true;
            }

            assert.strictEqual(errorThrown, false);
        });

        it('should accept alternative crn format with digit 8', async () => {
            mockRequest.query.crn = '12-845678';
            const handler = router.stack[0].route.stack[0].handle;

            let errorThrown = false;
            try {
                await handler(mockRequest, mockResponse, (err) => {
                    if (err) errorThrown = true;
                });
            } catch {
                errorThrown = true;
            }

            assert.strictEqual(errorThrown, false);
        });

        it('should pass documentId to service', async () => {
            let capturedDocumentId;
            mockPageChunksService.getPageChunks = async (documentId) => {
                capturedDocumentId = documentId;
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(capturedDocumentId, 'doc-123');
        });

        it('should pass pageNumber to service', async () => {
            let capturedPageNumber;
            mockPageChunksService.getPageChunks = async (_, pageNumber) => {
                capturedPageNumber = pageNumber;
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(capturedPageNumber, '1');
        });

        it('should pass crn to service', async () => {
            let capturedCrn;
            mockPageChunksService.getPageChunks = async (_, __, crn) => {
                capturedCrn = crn;
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(capturedCrn, '12-745678');
        });

        it('should pass searchTerm to service', async () => {
            let capturedSearchTerm;
            mockPageChunksService.getPageChunks = async (_, __, ___, searchTerm) => {
                capturedSearchTerm = searchTerm;
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(capturedSearchTerm, 'test');
        });

        it('should pass logger to service', async () => {
            let capturedLogger;
            mockPageChunksService.getPageChunks = async (_, __, ___, ____, context) => {
                capturedLogger = context.logger;
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(capturedLogger, mockLogger);
        });

        it('should handle service errors via next middleware', async () => {
            const serviceError = new Error('Service failed');
            mockPageChunksService.getPageChunks = async () => {
                throw serviceError;
            };

            const handler = router.stack[0].route.stack[0].handle;
            let passedError;

            await handler(mockRequest, mockResponse, (err) => {
                passedError = err;
            });

            assert.strictEqual(passedError, serviceError);
        });

        it('should return correct response structure for multiple chunks', async () => {
            mockPageChunksService.getPageChunks = async () => {
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
                        chunk_text: 'Body'
                    }
                ];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(mockResponse.jsonData.data.attributes.chunks.length, 2);
            assert.strictEqual(mockResponse.jsonData.data.attributes.chunks[0].chunk_id, 'chunk-1');
            assert.strictEqual(mockResponse.jsonData.data.attributes.chunks[1].chunk_id, 'chunk-2');
        });

        it('should return empty chunks array when service returns empty', async () => {
            mockPageChunksService.getPageChunks = async () => {
                return [];
            };

            const handler = router.stack[0].route.stack[0].handle;
            await handler(mockRequest, mockResponse, () => {});

            assert.strictEqual(mockResponse.jsonData.data.attributes.chunks.length, 0);
        });
    });

    describe('router configuration', () => {
        it('should create a router with GET route', () => {
            assert.strictEqual(typeof router.get, 'function');
        });

        it('should have one route registered', () => {
            // Express stores routes in stack
            assert.strictEqual(router.stack.length > 0, true);
        });
    });
});
