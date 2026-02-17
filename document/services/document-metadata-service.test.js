import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';
import {
    buildPageMetadataApiBody,
    buildPageMetadataFixture
} from '../../test/fixtures/page-metadata.js';
import createDocumentMetadataService from './document-metadata-service.js';

describe('document-metadata-service', () => {
    let mockGet;
    let mockCreateRequestService;

    beforeEach(() => {
        process.env.APP_API_URL = 'http://find-tool.local';

        mockGet = mock.fn(() => {
            return {
                statusCode: 200,
                body: buildPageMetadataApiBody()
            };
        });

        mockCreateRequestService = mock.fn(() => {
            return {
                get: mockGet,
                post: mock.fn()
            };
        });
    });

    it('Should call get with correct URL and headers', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: '12-745678',
            jwtToken: 'fake-jwt-token',
            logger: fakeLogger,
            createRequestService: mockCreateRequestService
        });

        const result = await service.getPageMetadata();

        assert.deepEqual(result, buildPageMetadataFixture());
        assert.equal(mockCreateRequestService.mock.callCount(), 1);

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            'http://find-tool.local/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(mockGetCallArguments.headers.Authorization, 'Bearer fake-jwt-token');
    });

    it('Should include Authorization header when jwtToken is provided', async () => {
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 2,
            crn: '12-745678',
            jwtToken: 'my-token',
            createRequestService: mockCreateRequestService
        });

        await service.getPageMetadata();

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(mockGetCallArguments.headers.Authorization, 'Bearer my-token');
    });

    it('Should not include Authorization header when jwtToken is not provided', async () => {
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await service.getPageMetadata();

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(mockGetCallArguments.headers, undefined);
    });

    it('Should throw error for invalid document ID format', async () => {
        const service = createDocumentMetadataService({
            documentId: 'not-a-uuid',
            pageNumber: 1,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'Invalid document ID format'
        });
    });

    it('Should throw error for invalid page number (zero)', async () => {
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 0,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'Invalid page number'
        });
    });

    it('Should throw error for invalid page number (negative)', async () => {
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: -5,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'Invalid page number'
        });
    });

    it('Should throw error for invalid CRN format', async () => {
        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: 'invalid@crn!',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'Invalid case reference number format'
        });
    });

    it('Should throw error when APP_API_URL environment variable is not set', async () => {
        delete process.env.APP_API_URL;

        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'APP_API_URL environment variable is not set'
        });
    });

    it('Should throw error when API returns error response', async () => {
        mockGet = mock.fn(() => {
            return {
                statusCode: 404,
                body: {
                    errors: [{ detail: 'Page not found' }]
                }
            };
        });

        mockCreateRequestService = mock.fn(() => {
            return {
                get: mockGet,
                post: mock.fn()
            };
        });

        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'Page not found'
        });
    });

    it('Should throw error when no response body received', async () => {
        mockGet = mock.fn(() => {
            return {
                statusCode: 200,
                body: null
            };
        });

        mockCreateRequestService = mock.fn(() => {
            return {
                get: mockGet,
                post: mock.fn()
            };
        });

        const service = createDocumentMetadataService({
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 1,
            crn: '12-745678',
            createRequestService: mockCreateRequestService
        });

        await assert.rejects(async () => await service.getPageMetadata(), {
            message: 'No response body received from API'
        });
    });
});
