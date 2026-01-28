import assert from 'node:assert';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createApiRouter from '../../document/routes.js';
import createOpenApiValidatorMiddleware from './index.js';

/**
 * Creates and configures an Express application instance for testing.
 *
 * - Sets up AJV for JSON schema validation with custom error handling.
 * - Loads OpenAPI specification and attaches OpenAPI validator middleware.
 * - Configures JSON and URL-encoded body parsers.
 * - Injects a mock search service into the API router.
 * - Adds middleware for logging before and after validation.
 * - Mounts the API router under the '/api' path.
 * - Handles errors with a JSON error response.
 *
 * @async
 * @function
 * @returns {Promise<import('express').Express>} A configured Express application instance.
 */
async function makeApp() {
    const app = express();
    const ajv = new Ajv({ allErrors: true, coerceTypes: true, useDefaults: true, strict: false });
    ajvErrors(ajv, { singleError: true });

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const apiSpecPath = path.resolve(__dirname, '../../openapi/openapi-dist.json');
    // Attach validator middleware
    const validator = await createOpenApiValidatorMiddleware({ ajv, apiSpecPath });
    app.use(express.json({ type: 'application/vnd.api+json' }));
    app.use(express.urlencoded({ extended: true }));

    // Use the real router (with a mock search service)
    const mockSearchService = {
        getSearchResultsByKeyword: async () => ({ total: { value: 0 }, hits: [] })
    };
    app.use((req, res, next) => {
        console.info('Before validator');
        next();
    });
    app.use(validator);
    app.use((req, res, next) => {
        console.info('After validator');
        next();
    });
    app.use('/api', createApiRouter({ searchService: mockSearchService }));
    // Error handler
    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ errors: err.errors || [{ message: err.message }] });
    });

    return app;
}

describe('OpenAPI Validator Middleware', () => {
    let app;
    let validToken;

    before(async () => {
        app = await makeApp();
        validToken = jwt.sign(
            { userId: 'test-user-123', email: 'test@example.com' },
            'test-secret-for-api',
            { expiresIn: '1h' }
        );
    });

    it('responds with 400 for missing required "query" parameter', async () => {
        const res = await request(app)
            .get('/api/search')
            .set('Authorization', `Bearer ${validToken}`)
            .set('On-Behalf-Of', '25-111111');

        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.errors, 'Response should have errors');
        assert.match(res.body.errors[0].message, /must have required property 'query'/);
    });

    it('responds with 400 for invalid "query" parameter (too short)', async () => {
        const res = await request(app)
            .get('/api/search?query=a')
            .set('Authorization', `Bearer ${validToken}`)
            .set('On-Behalf-Of', '25-111111');

        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.errors, 'Response should have errors');
        assert.match(res.body.errors[0].message, /must NOT have fewer than 2 characters/);
    });

    it('responds with 400 for invalid "On-Behalf-Of" header', async () => {
        const res = await request(app)
            .get('/api/search?query=test')
            .set('Authorization', `Bearer ${validToken}`); // Missing header

        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.errors, 'Response should have errors');
        assert.match(res.body.errors[0].message, /must have required property 'on-behalf-of'/);
    });
});
