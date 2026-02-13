import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import createPageChunksService from './document-chunks-service.js';

describe('createPageChunksService', () => {
    let mockGet;
    let mockCreateRequestService;
    let mockLogger;
    const mockDocumentId = '4bcba3af-d9ab-53f2-9fd7-bf4263f8118e';
    const mockPageNumber = 3;
    const mockCrn = '26-711111';
    const mockJwtToken = 'mock-jwt-token';

    beforeEach(() => {
        let resolvedValue = null;
        let rejectedError = null;
        let shouldReject = false;

        mockGet = async (opts) => {
            mockGet.calls.push(opts);
            if (shouldReject) {
                throw rejectedError;
            }
            return resolvedValue;
        };

        mockGet.calls = [];

        mockGet.mockResolvedValue = function (value) {
            resolvedValue = value;
            shouldReject = false;
            return this;
        };

        mockGet.mockRejectedValue = function (error) {
            rejectedError = error;
            shouldReject = true;
            return this;
        };

        mockCreateRequestService = () => ({
            get: mockGet
        });

        mockLogger = {
            info: () => {},
            error: () => {}
        };
        process.env.APP_API_URL = 'http://localhost:3000/api';
    });

    describe('getPageChunks', () => {
        it('should fetch document page chunks successfully', async () => {
            const mockChunks = [
                {
                    chunk_id: 'chunk-1',
                    chunk_type: 'LAYOUT_HEADER',
                    chunk_index: 0,
                    bounding_box: {
                        width: 0.8,
                        height: 0.15,
                        left: 0.09,
                        top: 0.04,
                        right: 0.93,
                        bottom: 0.19
                    }
                },
                {
                    chunk_id: 'chunk-2',
                    chunk_type: 'LAYOUT_TEXT',
                    chunk_index: 1,
                    bounding_box: {
                        width: 0.7,
                        height: 0.1,
                        left: 0.1,
                        top: 0.2,
                        right: 0.8,
                        bottom: 0.3
                    }
                }
            ];

            mockGet.mockResolvedValue({
                body: {
                    data: {
                        type: 'page-chunks',
                        attributes: {
                            chunks: mockChunks
                        }
                    }
                }
            });

            const mockSearchTerm = 'test search';
            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: mockSearchTerm,
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            const result = await service.getPageChunks();

            assert.deepStrictEqual(result, mockChunks);
            assert.strictEqual(mockGet.calls.length, 1);
            assert.strictEqual(
                mockGet.calls[0].url,
                `http://localhost:3000/api/document/${mockDocumentId}/page/${mockPageNumber}/chunks?crn=${mockCrn}&searchTerm=${encodeURIComponent(mockSearchTerm)}`
            );
            assert.deepStrictEqual(mockGet.calls[0].headers, {
                Authorization: `Bearer ${mockJwtToken}`
            });
        });

        it('should return empty array when no chunks are found', async () => {
            mockGet.mockResolvedValue({
                body: {
                    data: {
                        type: 'page-chunks',
                        attributes: {
                            chunks: []
                        }
                    }
                }
            });

            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            const result = await service.getPageChunks();

            assert.deepStrictEqual(result, []);
        });

        it('should include searchTerm in query parameters when provided', async () => {
            mockGet.mockResolvedValue({
                body: {
                    data: {
                        type: 'page-chunks',
                        attributes: {
                            chunks: []
                        }
                    }
                }
            });

            const mockSearchTerm = 'test search term';
            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: mockSearchTerm,
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            await service.getPageChunks();

            assert.strictEqual(mockGet.calls.length, 1);
            assert.strictEqual(mockGet.calls[0].url.includes(`crn=${mockCrn}`), true);
            assert.strictEqual(
                mockGet.calls[0].url.includes(`searchTerm=${encodeURIComponent(mockSearchTerm)}`),
                true
            );
        });

        it('should handle missing data structure gracefully', async () => {
            mockGet.mockResolvedValue({
                body: {
                    data: null
                }
            });

            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            const result = await service.getPageChunks();

            assert.deepStrictEqual(result, []);
        });

        it('should throw error when API returns errors', async () => {
            const mockErrors = [
                {
                    status: '500',
                    title: 'Internal Server Error',
                    detail: 'Failed to query OpenSearch'
                }
            ];

            mockGet.mockResolvedValue({
                body: {
                    errors: mockErrors
                }
            });

            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: 'test search',
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            await assert.rejects(
                () => service.getPageChunks(),
                (err) => err.message === 'Failed to fetch page chunks from API'
            );
        });

        it('should handle network errors', async () => {
            const networkError = new Error('Network error');
            mockGet.mockRejectedValue(networkError);

            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: 'test search',
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            await assert.rejects(
                () => service.getPageChunks(),
                (err) => err.message === 'Network error'
            );
        });

        it('should not set Authorization header when jwtToken is not provided', async () => {
            mockGet.mockResolvedValue({
                body: {
                    data: {
                        type: 'page-chunks',
                        attributes: {
                            chunks: []
                        }
                    }
                }
            });

            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: 'test search',
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            await service.getPageChunks();

            assert.strictEqual(mockGet.calls.length, 1);
            assert.strictEqual(mockGet.calls[0].headers, undefined);
        });
    });

    describe('service creation', () => {
        it('should create a frozen service object', () => {
            const service = createPageChunksService({
                documentId: mockDocumentId,
                pageNumber: mockPageNumber,
                crn: mockCrn,
                searchTerm: 'test search',
                jwtToken: mockJwtToken,
                logger: mockLogger,
                createRequestService: mockCreateRequestService
            });

            assert.strictEqual(Object.isFrozen(service), true);
            assert.strictEqual(typeof service.getPageChunks, 'function');
        });
    });
});
