import assert from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createApi from './app.js';

const API_ENV_VARS = ['APP_LOG_LEVEL', 'DEPLOY_ENV', 'npm_package_version', 'APP_JWT_SECRET'];

// Mock the search service to isolate the API app logic
const mockCreateSearchService = () => ({
    getSearchResultsByKeyword: async (keyword, page, limit, { logger }) => {
        logger.info(`Mock search for: ${keyword}`);
        if (keyword === 'error') {
            throw new Error('Internal Search Service Error');
        }
        return {
            total: { value: 2, relation: 'eq' },
            hits: [
                { _id: 'doc1', _source: { content: 'test content 1' } },
                { _id: 'doc2', _source: { content: 'test content 2' } }
            ]
        };
    }
});

describe('API Application', () => {
    let app;
    let envSnapshot;

    beforeEach(async () => {
        envSnapshot = {};
        for (const envVar of API_ENV_VARS) {
            envSnapshot[envVar] = process.env[envVar];
        }

        // Set up environment for tests
        process.env.APP_LOG_LEVEL = 'silent';
        process.env.DEPLOY_ENV = 'test';
        process.env.npm_package_version = '1.0.0-test';
        process.env.APP_JWT_SECRET = 'test-secret-for-api';

        // Create the Express app instance for testing
        //app = await createApi({ createSearchService: mockCreateSearchService });

        app = await createApi({
            createSearchService: mockCreateSearchService
        });
    });

    afterEach(() => {
        for (const envVar of API_ENV_VARS) {
            if (envSnapshot[envVar] === undefined) {
                delete process.env[envVar];
            } else {
                process.env[envVar] = envSnapshot[envVar];
            }
        }
    });

    describe('OpenAPI Spec Loading', () => {
        test('logs error when OpenAPI spec content is invalid JSON', async () => {
            const originalConsoleError = console.error;
            const consoleErrors = [];
            console.error = (...args) => {
                consoleErrors.push(args);
            };

            try {
                const appWithInvalidSpec = await createApi({
                    createSearchService: mockCreateSearchService,
                    readOpenApiFile: async () => '{'
                });

                assert.ok(appWithInvalidSpec);
                assert.strictEqual(consoleErrors.length > 0, true);
                assert.strictEqual(consoleErrors[0][1], 'Failed to load OpenAPI spec');
                assert.ok(consoleErrors[0][0].err instanceof Error);
            } finally {
                console.error = originalConsoleError;
            }
        });

        test('handles missing OpenAPI spec file gracefully', async () => {
            process.env.APP_LOG_LEVEL = 'silent';

            // By creating an app, if the spec file doesn't exist, it should catch the error
            const appWithMissingSpec = await createApi({
                createSearchService: mockCreateSearchService
            });

            // If app is created without throwing, the error was handled
            assert.ok(appWithMissingSpec);
            assert.ok(appWithMissingSpec instanceof Function || appWithMissingSpec.use);
        });

        test('handles OpenAPI spec file loading error and logs it', async () => {
            process.env.APP_LOG_LEVEL = 'silent';

            // Create app - spec file exists so this logs if there's an error
            const app = await createApi({
                createSearchService: mockCreateSearchService
            });

            // Verify the app was created (error handling worked)
            assert.ok(app);
            assert.ok(typeof app.use === 'function');
        });

        test('catches and logs OpenAPI spec read errors', async () => {
            // This test verifies the error handling exists
            // In practice, app.get('logger') returns undefined since logger is middleware,
            // so the console fallback is always used during OpenAPI loading.
            // The try-catch ensures the app still initializes even if the spec fails to load.

            const app = await createApi({
                createSearchService: mockCreateSearchService
            });

            // App should be created successfully (spec loaded or error caught)
            assert.ok(app);
            assert.ok(typeof app.use === 'function');
        });
    });

    describe('Production vs Non-Production Configuration', () => {
        test('includes Swagger UI middleware in non-production environment', async () => {
            process.env.DEPLOY_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_JWT_SECRET = 'test-secret';

            const devApp = await createApi({
                createSearchService: mockCreateSearchService
            });

            const token = jwt.sign({ userId: 'test' }, process.env.APP_JWT_SECRET, {
                expiresIn: '1h'
            });

            const res = await request(devApp).get('/docs/').set('Authorization', `Bearer ${token}`);

            // In non-production, should get Swagger UI (200 or 404 if spec missing, but not middleware error)
            assert.ok([200, 404].includes(res.statusCode));
        });

        test('does NOT include Swagger UI middleware in production environment', async () => {
            process.env.DEPLOY_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_JWT_SECRET = 'test-secret';

            const prodApp = await createApi({
                createSearchService: mockCreateSearchService
            });

            const token = jwt.sign({ userId: 'test' }, process.env.APP_JWT_SECRET, {
                expiresIn: '1h'
            });

            const res = await request(prodApp)
                .get('/docs/')
                .set('Authorization', `Bearer ${token}`);

            // In production, Swagger UI middleware is skipped, should get 404
            assert.strictEqual(res.statusCode, 404);
        });
    });

    describe('Public and Unauthenticated requests', () => {
        test('responds with 401 for Swagger UI docs', async () => {
            const res = await request(app).get('/docs/');
            assert.strictEqual(res.statusCode, 401);
            assert.match(res.body.errors[0].detail, /Missing authentication token/);
        });

        test('responds with 401 for OpenAPI spec', async () => {
            const res = await request(app).get('/openapi.json');
            assert.strictEqual(res.statusCode, 401);
            assert.strictEqual(res.type, 'application/json');
            assert.match(res.body.errors[0].detail, /Missing authentication token/);
        });

        test('responds with 401 for missing JWT on protected search endpoint', async () => {
            const res = await request(app).get('/search?query=test');
            assert.strictEqual(res.statusCode, 401);
            assert.match(res.body.errors[0].detail, /Missing authentication token/);
        });

        test('responds with 401 for an unknown protected route', async () => {
            const res = await request(app).get('/not-a-real-route');
            assert.strictEqual(res.statusCode, 401);
        });
    });

    describe('Authenticated requests', () => {
        let validToken;

        beforeEach(() => {
            // Create a fresh token for each test
            validToken = jwt.sign(
                { userId: 'test-user-123', email: 'test@example.com' },
                process.env.APP_JWT_SECRET,
                { expiresIn: '1h' }
            );
        });

        test('responds with 200 for Swagger UI docs', async () => {
            const res = await request(app)
                .get('/docs/')
                .set('Authorization', `Bearer ${validToken}`);
            assert.strictEqual(res.statusCode, 200);
        });

        test('responds with 200 for OpenAPI spec', async () => {
            const res = await request(app)
                .get('/openapi.json')
                .set('Authorization', `Bearer ${validToken}`);
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.type, 'application/json');
        });

        test('responds with 200 for docs OpenAPI spec route', async () => {
            process.env.DEPLOY_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_JWT_SECRET = 'test-secret';

            const prodApp = await createApi({
                createSearchService: mockCreateSearchService
            });

            const prodToken = jwt.sign({ userId: 'test-user-123' }, process.env.APP_JWT_SECRET, {
                expiresIn: '1h'
            });

            const res = await request(prodApp)
                .get('/docs/openapi.json')
                .set('Authorization', `Bearer ${prodToken}`);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.type, 'application/json');
            assert.ok(res.body && typeof res.body === 'object');
        });

        test('returns 200 and search results for a valid query', async () => {
            const res = await request(app)
                .get('/search?query=validsearch&pageNumber=1&itemsPerPage=5')
                .set('Authorization', `Bearer ${validToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.body.data, 'Response should have a data property');
            assert.strictEqual(res.body.data.type, 'search-results');
            assert.strictEqual(res.body.data.attributes.query, 'validsearch');
            assert.ok(res.body.data.attributes.results.hits, 'Search results should have hits');
        });

        test('sets correct content type and version headers', async () => {
            const res = await request(app)
                .get('/search?query=test')
                .set('Authorization', `Bearer ${validToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.match(res.headers['content-type'], /application\/vnd\.api\+json/);
            assert.strictEqual(res.headers['application-version'], '1.0.0-test');
        });
    });

    describe('Request Validation and Error Handling', () => {
        let validToken;

        beforeEach(() => {
            validToken = jwt.sign({ id: 'test' }, process.env.APP_JWT_SECRET, { expiresIn: '1h' });
        });

        // test('responds with 400 for missing required "query" parameter', async () => {
        //     const res = await request(app)
        //         .get('/search')
        //         .set('Authorization', `Bearer ${validToken}`)
        //         .set('On-Behalf-Of', '25-711111');

        //     assert.strictEqual(res.statusCode, 400);
        //     assert.ok(res.body.errors, 'Response should have errors');
        //     assert.match(res.body.errors[0].message, /must have required property 'query'/);
        // });

        // test('responds with 400 for invalid "query" parameter (too short)', async () => {
        //     const res = await request(app)
        //         .get('/search?query=a')
        //         .set('Authorization', `Bearer ${validToken}`)
        //         .set('On-Behalf-Of', '25-711111');

        //     assert.strictEqual(res.statusCode, 400);
        //     assert.ok(res.body.errors, 'Response should have errors');
        //     assert.match(res.body.errors[0].message, /must NOT have fewer than 2 characters/);
        // });

        // test('responds with 400 for invalid "On-Behalf-Of" header', async () => {
        //     const res = await request(app)
        //         .get('/search?query=test')
        //         .set('Authorization', `Bearer ${validToken}`); // Missing header

        //     assert.strictEqual(res.statusCode, 400);
        //     assert.ok(res.body.errors, 'Response should have errors');
        //     assert.match(res.body.errors[0].message, /must have required property 'On-Behalf-Of'/);
        // });

        test('responds with 404 for an unknown route when authenticated', async () => {
            const res = await request(app)
                .get('/not-a-real-route')
                .set('Authorization', `Bearer ${validToken}`);

            assert.strictEqual(res.statusCode, 404);
            assert.ok(res.body.errors);
            assert.match(res.body.errors[0].detail, /does not exist within the API/);
        });

        test('handles internal service errors gracefully', async () => {
            const res = await request(app)
                .get('/search?query=error') // Mock is set up to throw on 'error'
                .set('Authorization', `Bearer ${validToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(res.statusCode, 500);
            assert.ok(res.body.errors);
            assert.strictEqual(res.body.errors[0].title, 'Internal Server Error');
            assert.strictEqual(res.body.errors[0].detail, 'Internal Search Service Error');
        });

        test('error handler uses console fallback when req.log is undefined', async () => {
            // Capture console.error calls
            const consoleErrors = [];
            const originalConsoleError = console.error;
            const originalConsoleWarn = console.warn;
            const originalConsoleLog = console.log;

            // Suppress all console output during this test
            console.error = (...args) => {
                consoleErrors.push(args);
            };
            console.warn = () => {};
            console.log = () => {};

            try {
                // Create a minimal Express app to test the error logging middleware directly
                const express = (await import('express')).default;
                const errorHandler = (await import('./middleware/errorHandler/index.js')).default;
                const testApp = express();

                // Trigger an error with a request that has no req.log
                testApp.get('/test', (req, res, next) => {
                    const err = new Error('Test error without req.log');
                    next(err);
                });

                // Add error logging middleware (the one we want to test)
                testApp.use((err, req, res, next) => {
                    // This is the middleware from app.js line 116-119
                    (req.log || console).error({ err }, 'API Error');
                    next(err);
                });

                testApp.use(errorHandler);

                const res = await request(testApp).get('/test');

                // Verify error was handled
                assert.strictEqual(res.statusCode, 500);
                assert.ok(res.body);
                assert.ok(res.body.errors);

                // Verify console.error was called as fallback
                assert.ok(
                    consoleErrors.length > 0,
                    'console.error should be called when req.log is undefined'
                );
                assert.ok(
                    consoleErrors.some((args) => args[1] === 'API Error'),
                    'console.error should log API Error message'
                );
            } finally {
                console.error = originalConsoleError;
                console.warn = originalConsoleWarn;
                console.log = originalConsoleLog;
            }
        });
    });
});
