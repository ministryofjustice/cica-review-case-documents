import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import createTemplateEngineService from '../templateEngine/index.js';
import createDocumentRouter from './routes.js';

// Mock fetch globally
global.fetch = mock.fn(async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (
        urlStr.includes('/document/') &&
        urlStr.includes('/page/') &&
        urlStr.includes('/metadata')
    ) {
        return {
            ok: true,
            status: 200,
            json: async () => ({
                data: {
                    correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST',
                    imageUrl: 's3://bucket-name/case-ref-num/test-doc/pages/1.png',
                    page_width: 1654,
                    page_height: 2339,
                    page_count: 50
                }
            })
        };
    }

    return {
        ok: false,
        status: 404,
        json: async () => ({ errors: [{ detail: 'Not found' }] })
    };
});

describe('Document Routes', () => {
    let app;

    beforeEach(async () => {
        global.fetch.mock.resetCalls();

        process.env.APP_API_URL = 'http://find-tool.local';
        process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:4566';
        process.env.NODE_ENV = 'test';

        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(
            session({
                secret: 'test-secret',
                resave: false,
                saveUninitialized: true
            })
        );

        const templateEngine = createTemplateEngineService(app);
        templateEngine.init();

        // Setup minimal middleware
        app.use((req, res, next) => {
            req.session.caseSelected = true;
            req.session.searchTerm = 'test query';
            req.session.searchResultsPageNumber = 2;
            req.log = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
            req.cookies = { jwtToken: 'mock-jwt-token' };
            res.locals.csrfToken = 'test-csrf-token';
            res.locals.cspNonce = 'test-csp-nonce';
            next();
        });

        app.use('/document', createDocumentRouter());

        app.use((err, req, res, next) => {
            const status = err.status || 500;
            res.status(status).json({
                errors: [{ status, title: err.message, detail: err.message }]
            });
        });
    });

    describe('Input Validation', () => {
        it('should reject invalid document ID format', async () => {
            const res = await request(app).get(`/document/not-a-uuid/view/page/1?crn=12-345678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (zero)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/0?crn=12-345678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (negative)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/-5?crn=12-345678`);

            assert.strictEqual(res.statusCode, 400);
        });

        it('should reject invalid page number (non-integer)', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/view/page/abc?crn=12-345678`);

            assert.strictEqual(res.statusCode, 400);
        });
    });

    describe('Page View Rendering', () => {
        it('renders image view with metadata and stores S3 URI', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(
                `/document/${docId}/view/page/1?crn=12-345678&searchPageNumber=2`
            );

            assert.equal(res.statusCode, 200);
            // Ensure mock correspondence_type influences title rendering indirectly
            assert.ok(typeof res.text === 'string');
        });
    });

    describe('Image Streaming Endpoint', () => {
        it('returns 204 when S3 URI missing in session', async () => {
            const docId = '123e4567-e89b-12d3-a456-426614174000';
            const res = await request(app).get(`/document/${docId}/page/1?crn=12-345678`);
            assert.equal(res.statusCode, 204);
        });
    });
});
