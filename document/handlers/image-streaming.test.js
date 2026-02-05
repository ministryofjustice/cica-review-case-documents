import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it, mock } from 'node:test';
import { createImageStreamingHandler } from './image-streaming.js';

describe('Image Streaming Handler', () => {
    let mockS3Client;
    let mockCreateMetadataService;

    beforeEach(() => {
        // Create a mock S3 client
        mockS3Client = {
            send: mock.fn()
        };

        // Create a mock metadata service factory
        mockCreateMetadataService = mock.fn();
    });

    describe('Successful Image Streaming', () => {
        it('streams image with correct content type and length', async () => {
            const mockStream = new Readable();
            mockStream.push('image data');
            mockStream.push(null);

            mockS3Client.send = mock.fn(async () =>
                Promise.resolve({
                    Body: mockStream,
                    ContentType: 'image/png',
                    ContentLength: 1024
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    correspondence_type: 'TC19 - REQUEST',
                    imageUrl: 's3://bucket-name/path/to/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                params: { documentId: '123e4567-e89b-12d3-a456-426614174000', pageNumber: '1' },
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                query: { crn: 'CASE-2024' },
                cookies: { jwtToken: 'test-token' },
                log: { info: () => {}, warn: () => {}, error: () => {} }
            };

            const res = {
                set: mock.fn(),
                statusCode: 200
            };

            // Mock pipe to capture what would be streamed
            mockStream.pipe = mock.fn(() => mockStream);

            await handler(req, res);

            assert.equal(mockS3Client.send.mock.calls.length, 1);
            assert.equal(res.set.mock.calls.length, 2); // Content-Type and Content-Length
            assert.deepEqual(res.set.mock.calls[0].arguments, ['Content-Type', 'image/png']);
            assert.deepEqual(res.set.mock.calls[1].arguments, ['Content-Length', 1024]);
        });

        it('uses default image/png content type when not provided by S3', async () => {
            const mockStream = new Readable();
            mockStream.push('image data');
            mockStream.push(null);

            mockS3Client.send = mock.fn(async () =>
                Promise.resolve({
                    Body: mockStream,
                    ContentType: undefined,
                    ContentLength: 512
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/path/to/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: () => {}, warn: () => {}, error: () => {} }
            };

            const res = {
                set: mock.fn()
            };

            mockStream.pipe = mock.fn(() => mockStream);

            await handler(req, res);

            assert.deepEqual(res.set.mock.calls[0].arguments, ['Content-Type', 'image/png']);
        });

        it('does not set Content-Length when not provided by S3', async () => {
            const mockStream = new Readable();
            mockStream.push('image data');
            mockStream.push(null);

            mockS3Client.send = mock.fn(async () =>
                Promise.resolve({
                    Body: mockStream,
                    ContentType: 'image/jpeg',
                    ContentLength: undefined
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/path/to/image.jpg'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: () => {}, warn: () => {}, error: () => {} }
            };

            const res = {
                set: mock.fn()
            };

            mockStream.pipe = mock.fn(() => mockStream);

            await handler(req, res);

            // Should only have one set call (Content-Type), not Content-Length
            assert.equal(res.set.mock.calls.length, 1);
            assert.deepEqual(res.set.mock.calls[0].arguments, ['Content-Type', 'image/jpeg']);
        });

        it('correctly parses S3 URI with multiple path segments', async () => {
            const mockStream = new Readable();
            mockStream.push('image data');
            mockStream.push(null);

            mockS3Client.send = mock.fn(async () =>
                Promise.resolve({
                    Body: mockStream,
                    ContentType: 'image/png'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://my-bucket/case-ref-num/document-id/pages/1.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: () => {}, warn: () => {}, error: () => {} }
            };

            const res = {
                set: mock.fn()
            };

            mockStream.pipe = mock.fn(() => mockStream);

            await handler(req, res);

            const sendCall = mockS3Client.send.mock.calls[0].arguments[0];
            assert.equal(sendCall.input.Bucket, 'my-bucket');
            assert.equal(sendCall.input.Key, 'case-ref-num/document-id/pages/1.png');
        });
    });

    describe('Metadata Fetch Failures', () => {
        it('returns 204 when metadata service throws', async () => {
            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => {
                    throw new Error('API connection failed');
                })
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: { jwtToken: 'test-token' },
                log: { info: () => {}, warn: mock.fn(), error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
            assert.equal(res.end.mock.calls.length, 1);
            assert.equal(req.log.warn.mock.calls.length, 1);
        });

        it('logs metadata fetch errors with context', async () => {
            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => {
                    throw new Error('Timeout');
                })
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const pageNumber = 5;
            const crn = 'CASE-2024-001';

            const req = {
                validatedParams: { documentId: docId, pageNumber, crn },
                cookies: {},
                log: { warn: mock.fn(), info: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            const logCall = req.log.warn.mock.calls[0].arguments[0];
            assert.equal(logCall.documentId, docId);
            assert.equal(logCall.pageNumber, pageNumber);
            assert.equal(logCall.crn, crn);
            assert.match(logCall.error, /Timeout/);
        });
    });

    describe('Missing Image URL', () => {
        it('returns 204 when imageUrl is missing from metadata', async () => {
            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    correspondence_type: 'TC19 - REQUEST',
                    page_width: 1600,
                    page_height: 2000
                    // No imageUrl
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { warn: mock.fn(), info: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
            assert.equal(req.log.warn.mock.calls.length, 1);
        });

        it('logs missing imageUrl with document context', async () => {
            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    correspondence_type: 'TC19 - REQUEST'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const pageNumber = 3;
            const crn = 'CASE-2024-002';

            const req = {
                validatedParams: { documentId: docId, pageNumber, crn },
                cookies: {},
                log: { warn: mock.fn(), info: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            const logCall = req.log.warn.mock.calls[0].arguments[0];
            assert.equal(logCall.documentId, docId);
            assert.equal(logCall.pageNumber, pageNumber);
            assert.equal(logCall.crn, crn);
        });
    });

    describe('S3 Errors', () => {
        it('returns 204 for NoSuchKey error', async () => {
            mockS3Client.send = mock.fn(async () =>
                Promise.reject({
                    name: 'NoSuchKey',
                    message: 'The specified key does not exist'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/missing/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: mock.fn(), warn: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
            assert.equal(req.log.info.mock.calls.length, 1);
        });

        it('returns 204 for NotFound error', async () => {
            mockS3Client.send = mock.fn(async () =>
                Promise.reject({
                    Code: 'NotFound',
                    message: 'Not Found'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/missing/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: mock.fn(), warn: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
        });

        it('returns 204 for "does not exist" error message', async () => {
            mockS3Client.send = mock.fn(async () =>
                Promise.reject({
                    message: 'The specified bucket does not exist'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://missing-bucket/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { info: mock.fn(), warn: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
        });

        it('returns 204 for other S3 errors with warning log', async () => {
            mockS3Client.send = mock.fn(async () =>
                Promise.reject({
                    name: 'AccessDenied',
                    message: 'Access Denied'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/restricted/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const req = {
                validatedParams: {
                    documentId: '123e4567-e89b-12d3-a456-426614174000',
                    pageNumber: 1,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { warn: mock.fn(), info: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 204);
            assert.equal(req.log.warn.mock.calls.length, 1);
        });

        it('logs S3 errors with document context', async () => {
            mockS3Client.send = mock.fn(async () =>
                Promise.reject({
                    name: 'ServiceUnavailable',
                    message: 'Service Unavailable'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const pageNumber = 2;

            const req = {
                validatedParams: {
                    documentId: docId,
                    pageNumber: pageNumber,
                    crn: 'CASE-2024'
                },
                cookies: {},
                log: { warn: mock.fn(), info: () => {}, error: () => {} }
            };

            const res = {
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                end: mock.fn()
            };

            await handler(req, res);

            const logCall = req.log.warn.mock.calls[0].arguments[0];
            assert.equal(logCall.documentId, docId);
            assert.equal(logCall.pageNumber, pageNumber);
            assert.match(logCall.error, /Service Unavailable/);
        });
    });

    describe('Outer Error Handler', () => {
        it('returns 500 error for unexpected exceptions in response handling', async () => {
            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            // Create a validatedParams object that throws when accessed
            const req = {
                get validatedParams() {
                    throw new Error('Unexpected error accessing validatedParams');
                },
                cookies: {},
                log: { error: mock.fn(), warn: () => {}, info: () => {} }
            };

            const res = {
                set: mock.fn(),
                status: mock.fn((code) => {
                    res.statusCode = code;
                    return res;
                }),
                json: mock.fn()
            };

            await handler(req, res);

            assert.equal(res.status.mock.calls[0].arguments[0], 500);
            assert.equal(req.log.error.mock.calls.length, 1);
            assert.match(
                req.log.error.mock.calls[0].arguments[0].error,
                /Unexpected error accessing validatedParams/
            );
            assert.equal(res.json.mock.calls.length, 1);
            const errorPayload = res.json.mock.calls[0].arguments[0];
            assert.ok(errorPayload.errors);
            assert.equal(errorPayload.errors[0].status, 500);
            assert.equal(errorPayload.errors[0].title, 'Internal Server Error');
        });
    });

    describe('Metadata Service Factory', () => {
        it('calls metadata service factory with correct parameters', async () => {
            const mockStream = new Readable();
            mockStream.push('image data');
            mockStream.push(null);

            mockS3Client.send = mock.fn(async () =>
                Promise.resolve({
                    Body: mockStream,
                    ContentType: 'image/png'
                })
            );

            const mockMetadataService = {
                getPageMetadata: mock.fn(async () => ({
                    imageUrl: 's3://bucket-name/image.png'
                }))
            };
            mockCreateMetadataService = mock.fn(() => mockMetadataService);

            const handler = createImageStreamingHandler(mockS3Client, mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const pageNumber = 5;
            const crn = 'CASE-2024-001';
            const jwtToken = 'test-jwt-token';

            const req = {
                validatedParams: { documentId: docId, pageNumber, crn },
                cookies: { jwtToken },
                log: { warn: () => {}, info: () => {}, error: () => {} }
            };

            const res = {
                set: mock.fn()
            };

            mockStream.pipe = mock.fn(() => mockStream);

            await handler(req, res);

            const factoryCall = mockCreateMetadataService.mock.calls[0].arguments[0];
            assert.equal(factoryCall.documentId, docId);
            assert.equal(factoryCall.pageNumber, pageNumber);
            assert.equal(factoryCall.crn, crn);
            assert.equal(factoryCall.jwtToken, jwtToken);
            assert.ok(factoryCall.logger);
        });
    });
});
