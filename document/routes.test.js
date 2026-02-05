import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import createTemplateEngineService from '../templateEngine/index.js';
import createDocumentRouter from './routes.js';

/**
 * Helper function to set up a test express app with required middleware
 */
function createTestApp(mockCreateDocumentMetadataService) {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(express.urlencoded({ extended: true }));
    testApp.use(
        session({
            secret: 'fake-secret',
            resave: false,
            saveUninitialized: true
        })
    );

    const templateEngine = createTemplateEngineService(testApp);
    templateEngine.init();

    // Setup minimal middleware
    testApp.use((req, res, next) => {
        req.session.caseSelected = true;
        req.log = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        req.cookies = { jwtToken: 'mock-jwt-token' };
        res.locals.csrfToken = 'test-csrf-token';
        res.locals.cspNonce = 'test-csp-nonce';
        next();
    });

    // Inject mock service into routes
    testApp.use(
        '/document',
        createDocumentRouter({
            createDocumentMetadataService: mockCreateDocumentMetadataService
        })
    );

    testApp.use((err, req, res, next) => {
        const status = err.status || 500;
        res.status(status).json({
            errors: [{ status, title: err.message, detail: err.message }]
        });
    });

    return testApp;
}

describe('Document Routes', () => {
    let app;
    let mockGetPageMetadata;
    let mockCreateDocumentMetadataService;

    beforeEach(async () => {
        process.env.APP_API_URL = 'http://find-tool.local';
        process.env.NODE_ENV = 'test';

        // Mock the getPageMetadata method
        mockGetPageMetadata = mock.fn(async () => ({
            correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST',
            imageUrl: 's3://bucket-name/case-ref-num/test-doc/pages/1.png',
            page_width: 1654,
            page_height: 2339,
            page_count: 5
        }));

        // Mock the createDocumentMetadataService factory
        mockCreateDocumentMetadataService = mock.fn(() => ({
            getPageMetadata: mockGetPageMetadata
        }));

        app = createTestApp(mockCreateDocumentMetadataService);
    });

    describe('Input Validation', () => {
        it('should reject invalid document ID format', async () => {
            const res = await request(app).get(`/document/not-a-uuid/view/page/1?crn=12-745678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (zero)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/0?crn=12-745678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (negative)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/-5?crn=12-745678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (non-integer)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/abc?crn=12-745678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject missing CRN parameter', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/1`);

            assert.strictEqual(res.statusCode, 400);
        });
    });

    describe('Page View Rendering', () => {
        it('renders image view with metadata and query parameters', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(
                `/document/${docId}/view/page/1?crn=12-745678&searchTerm=test%20query&searchResultsPageNumber=2`
            );

            assert.equal(res.statusCode, 200);
            // Ensure mock correspondence_type influences title rendering indirectly
            assert.ok(typeof res.text === 'string');
        });

        it('handles metadata fetch failure gracefully', async () => {
            // Create a mock that throws an error
            const failingMetadataService = {
                getPageMetadata: () => Promise.reject(new Error('API connection failed'))
            };
            const mockCreateMetadataService = () => failingMetadataService;

            const appWithFailingService = createTestApp(mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(appWithFailingService).get(
                `/document/${docId}/view/page/1?crn=12-745678`
            );

            assert.equal(res.statusCode, 500);
        });
    });

    describe('Text View Endpoint', () => {
        it('renders text view with valid parameters', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(
                `/document/${docId}/view/text/page/1?crn=12-745678&searchTerm=test&searchResultsPageNumber=2`
            );

            assert.equal(res.statusCode, 200);
            assert.ok(typeof res.text === 'string');
        });

        it('returns 400 for invalid documentId in text view', async () => {
            const res = await request(app).get(
                `/document/invalid-id/view/text/page/1?crn=12-745678`
            );

            assert.equal(res.statusCode, 400);
        });

        it('returns 400 for invalid page number in text view', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/text/page/0?crn=12-745678`);

            assert.equal(res.statusCode, 400);
        });

        it('returns 400 for missing crn in text view', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/text/page/1`);

            assert.equal(res.statusCode, 400);
        });
    });

    describe('Image Streaming Endpoint', () => {
        it('returns 400 for invalid documentId in image streaming', async () => {
            const res = await request(app).get(`/document/not-a-uuid/page/1?crn=12-745678`);

            assert.equal(res.statusCode, 400);
        });

        it('returns 400 for invalid page number in image streaming', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/page/0?crn=12-745678`);

            assert.equal(res.statusCode, 400);
        });

        it('returns 400 for missing crn in image streaming', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/page/1`);

            assert.equal(res.statusCode, 400);
        });

        it('returns 204 when metadata fetch fails in image streaming', async () => {
            // Create a mock that throws an error
            const failingMetadataService = {
                getPageMetadata: () => Promise.reject(new Error('API connection failed'))
            };
            const mockCreateMetadataService = () => failingMetadataService;

            const appWithFailingService = createTestApp(mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(appWithFailingService).get(
                `/document/${docId}/page/1?crn=12-745678`
            );

            assert.equal(res.statusCode, 204);
        });

        it('returns 204 when imageUrl is missing in metadata', async () => {
            // Create a mock that returns metadata without imageUrl
            const metadataServiceWithoutUrl = {
                getPageMetadata: () => Promise.resolve({ correspondence_type: 'Test Document' })
            };
            const mockCreateMetadataService = () => metadataServiceWithoutUrl;

            const appWithMissingUrl = createTestApp(mockCreateMetadataService);

            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(appWithMissingUrl).get(
                `/document/${docId}/page/1?crn=12-745678`
            );

            assert.equal(res.statusCode, 204);
        });
    });
});
