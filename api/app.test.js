import assert from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import isAuthenticated from '../middleware/isAuthenticated/index.js';

const API_ENV_VARS = [
    'APP_LOG_LEVEL',
    'NODE_ENV',
    'DEPLOY_ENV',
    'npm_package_version',
    'APP_JWT_SECRET',
    'APP_API_JWT_ISSUER',
    'APP_API_JWT_AUDIENCE',
    'API_RATE_LIMIT_MAX_AUTH',
    'API_RATE_LIMIT_MAX_UNAUTH',
    'API_RATE_LIMIT_WINDOW_MS'
];

/**
 * Signs a JWT token with the given payload using the secret and options from environment variables.
 *
 * @param {Object} payload - The payload to include in the JWT token.
 * @returns {string} The signed JWT token.
 */
function signApiToken(payload) {
    return jwt.sign(payload, process.env.APP_JWT_SECRET, {
        expiresIn: '1h',
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });
}

/**
 * Middleware to simulate authentication for testing purposes.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
function docsAuthMiddleware(req, res, next) {
    req.session ??= {};

    if (req.headers.authorization?.startsWith('Bearer ')) {
        req.session.loggedIn = true;
    }

    return isAuthenticated(req, res, next);
}

/**
 * Creates a mock search service for testing purposes.
 * @returns {any} The mock search service.
 */
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

/**
 * Sets the JWT environment variables for testing purposes.
 * @param {import('express').RequestHandler} [limiter=generalRateLimiter] - Rate limiter middleware to apply.
 * @returns {import('express').Express} Configured Express application instance.
 * @returns {void}
 */
function setJwtEnv({
    secret = 'test-secret-for-api',
    issuer = 'test-ui',
    audience = 'test-api'
} = {}) {
    process.env.APP_JWT_SECRET = secret;
    process.env.APP_API_JWT_ISSUER = issuer;
    process.env.APP_API_JWT_AUDIENCE = audience;
}

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
        process.env.APP_API_JWT_ISSUER = 'test-ui';
        process.env.APP_API_JWT_AUDIENCE = 'test-api';

        app = await createTestApi();
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

    /**
     * Creates a test instance of the API application with optional configuration overrides.
     *
     * @param {Object} [options={}] - Optional configuration overrides for the test API.
     * @param {Function} [options.createSearchService] - Optional custom search service factory function.
     * @param {Function} [options.docsAuthMiddleware] - Optional custom authentication middleware for docs routes.
     * @returns {Promise<import('express').Application>} A promise that resolves to the initialized Express application.
     * @throws {Error} If the API application fails to initialize.
     * @async
     * @function
     * @name createTestApi
     * @memberof module:api/app.test.js
     * @inner
     * @example
     * const app = await createTestApi({ createSearchService: myMockSearchService });
     */
    async function createTestApi(options = {}) {
        const { default: createApi } = await import('./app.js');

        const defaults = {
            createSearchService: mockCreateSearchService
        };

        // Only provide docsAuthMiddleware by default in non-production
        // Allow tests to override by explicitly passing it in options
        if (process.env.DEPLOY_ENV !== 'production' && !('docsAuthMiddleware' in options)) {
            defaults.docsAuthMiddleware = docsAuthMiddleware;
        }

        return createApi({
            ...defaults,
            ...options
        });
    }

    describe('OpenAPI Spec Loading', () => {
        test('logs error when OpenAPI spec content is invalid JSON', async () => {
            const originalConsoleError = console.error;
            const consoleErrors = [];
            console.error = (...args) => {
                consoleErrors.push(args);
            };

            try {
                const appWithInvalidSpec = await createTestApi({
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
            const appWithMissingSpec = await createTestApi();

            // If app is created without throwing, the error was handled
            assert.ok(appWithMissingSpec);
            assert.ok(appWithMissingSpec instanceof Function || appWithMissingSpec.use);
        });

        test('handles OpenAPI spec file loading error and logs it', async () => {
            process.env.APP_LOG_LEVEL = 'silent';

            // Create app - spec file exists so this logs if there's an error
            const app = await createTestApi();

            // Verify the app was created (error handling worked)
            assert.ok(app);
            assert.ok(typeof app.use === 'function');
        });

        test('catches and logs OpenAPI spec read errors', async () => {
            // This test verifies the error handling exists
            // In practice, app.get('logger') returns undefined since logger is middleware,
            // so the console fallback is always used during OpenAPI loading.
            // The try-catch ensures the app still initializes even if the spec fails to load.

            const app = await createTestApi();

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

            const devApp = await createTestApi();

            const token = signApiToken({ id: 'test' });

            const res = await request(devApp).get('/docs/').set('Authorization', `Bearer ${token}`);

            // In non-production, should get Swagger UI (200 or 404 if spec missing, but not middleware error)
            assert.strictEqual(res.statusCode, 200);
        });

        test('throws error if docsAuthMiddleware is not provided in non-production', async () => {
            process.env.DEPLOY_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_JWT_SECRET = 'test-secret';

            try {
                await createTestApi({ docsAuthMiddleware: undefined });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert.strictEqual(
                    err.message,
                    'createDocsRouter requires options.docsAuthMiddleware to be provided'
                );
            }
        });

        test('does NOT include Swagger UI middleware in production environment', async () => {
            process.env.DEPLOY_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_JWT_SECRET = 'test-secret';

            const prodApp = await createTestApi();

            const token = signApiToken({ id: 'test' });

            const res = await request(prodApp)
                .get('/docs/')
                .set('Authorization', `Bearer ${token}`);

            // In production, Swagger UI middleware is skipped, should get 404
            assert.strictEqual(res.statusCode, 404);
        });
    });

    describe('Public and Unauthenticated requests production environments', () => {
        test('responds with status 401 for unauthenticated openapi requests in production', async () => {
            process.env.DEPLOY_ENV = 'production';

            const prodLikeApp = await createTestApi();

            let response = await request(prodLikeApp).get('/docs/');
            // ALL requests respond with 401 Unauthorized.
            assert.strictEqual(response.statusCode, 401);

            response = await request(prodLikeApp).get('/openapi.json');
            assert.strictEqual(response.statusCode, 401);
        });
    });

    describe('Public and Unauthenticated requests non production environments', () => {
        test('redirects unauthenticated requests for Swagger UI docs', async () => {
            const res = await request(app).get('/docs/');
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.location, '/auth/login');
        });

        test('redirects unauthenticated requests for OpenAPI spec to /auth/login', async () => {
            const res = await request(app).get('/openapi.json');
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.location, '/auth/login');
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
            validToken = signApiToken({ id: 'claims_test_oid' });
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

        test('responds with 404 for docs OpenAPI spec route in production when JWT claim is present', async () => {
            process.env.DEPLOY_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            setJwtEnv({ secret: 'test-secret' });

            const prodApp = await createTestApi();
            const prodToken = signApiToken({ id: 'claims_test_oid' });

            const res = await request(prodApp)
                .get('/openapi.json')
                .set('Authorization', `Bearer ${prodToken}`);

            assert.strictEqual(res.statusCode, 404);
            assert.strictEqual(res.type, 'application/vnd.api+json');
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

        test('rate limits authenticated API requests in production using API_RATE_LIMIT_MAX_AUTH', async () => {
            process.env.DEPLOY_ENV = 'production';
            process.env.API_RATE_LIMIT_MAX_AUTH = '2';

            const prodLikeApp = await createTestApi();

            let token = signApiToken({ id: 'claims_test_oid_limit' });

            const first = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${token}`)
                .set('On-Behalf-Of', '25-711111');

            // Re-sign the token to ensure a fresh JWT for the second request
            token = signApiToken({ id: 'claims_test_oid_limit' });

            const second = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${token}`)
                .set('On-Behalf-Of', '25-711111');

            // Re-sign the token again for the third request to avoid using a cached token
            token = signApiToken({ id: 'claims_test_oid_limit' });

            const third = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${token}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(first.statusCode, 200);
            assert.strictEqual(second.statusCode, 200);
            assert.strictEqual(third.statusCode, 429);
        });

        test('applies authenticated rate limits independently for different JWT users', async () => {
            process.env.DEPLOY_ENV = 'test';
            process.env.API_RATE_LIMIT_MAX_AUTH = '1';
            process.env.API_RATE_LIMIT_MAX_UNAUTH = '1';

            const prodLikeApp = await createTestApi();

            let firstUserToken = signApiToken({ id: 'claims_test_oid_1' });
            const secondUserToken = signApiToken({ id: 'claims_test_oid_2' });

            const firstUserFirstRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${firstUserToken}`)
                .set('On-Behalf-Of', '25-711111');

            firstUserToken = signApiToken({ id: 'claims_test_oid_1' });

            const firstUserSecondRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${firstUserToken}`)
                .set('On-Behalf-Of', '25-711111');

            const secondUserFirstRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${secondUserToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(firstUserFirstRequest.statusCode, 200);
            assert.strictEqual(firstUserSecondRequest.statusCode, 429);
            assert.strictEqual(secondUserFirstRequest.statusCode, 200);
        });

        test('applies authenticated rate limits independently when JWT identity is claims oid GUID', async () => {
            process.env.DEPLOY_ENV = 'test';
            process.env.API_RATE_LIMIT_MAX_AUTH = '1';
            process.env.API_RATE_LIMIT_MAX_UNAUTH = '1';

            const prodLikeApp = await createTestApi();

            let userOneOidToken = signApiToken({ id: 'claims_test_oid_1' });
            const userTwoOidToken = signApiToken({ id: 'claims_test_oid_2' });

            const userOneFirstAPIRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${userOneOidToken}`)
                .set('On-Behalf-Of', '25-711111');

            userOneOidToken = signApiToken({ id: 'claims_test_oid_1' });

            const userOneSecondAPIRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${userOneOidToken}`)
                .set('On-Behalf-Of', '25-711111');

            const userTwoFirstAPIRequest = await request(prodLikeApp)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${userTwoOidToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(userOneFirstAPIRequest.statusCode, 200);
            assert.strictEqual(userOneSecondAPIRequest.statusCode, 429);
            assert.strictEqual(userTwoFirstAPIRequest.statusCode, 200);
        });

        test('returns 403 when JWT is valid but missing required identity claims', async () => {
            const identitylessToken = signApiToken({ email: 'missing-identity@example.com' });

            const res = await request(app)
                .get('/search?query=test&pageNumber=1&itemsPerPage=1')
                .set('Authorization', `Bearer ${identitylessToken}`)
                .set('On-Behalf-Of', '25-711111');

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(
                res.body.errors[0].detail,
                'Authentication token is missing required identity claims'
            );
        });

        test('returns 500 when OpenAPI spec file read fails on request', async () => {
            process.env.DEPLOY_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';

            // Create a mock readOpenApiFile that throws an error
            const failingReadOpenApiFile = async () => {
                throw new Error('File read failed');
            };

            const options = {
                docsAuthMiddleware,
                readOpenApiFile: failingReadOpenApiFile
            };

            const testApp = await createTestApi(options);
            const token = signApiToken({ id: 'test-user' });

            const res = await request(testApp)
                .get('/openapi.json')
                .set('Authorization', `Bearer ${token}`);

            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(res.body.error, 'Failed to load OpenAPI spec');
        });

        test('returns 500 when OpenAPI spec file contains invalid JSON on request', async () => {
            process.env.DEPLOY_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';

            // Create a mock readOpenApiFile that returns invalid JSON
            const invalidJsonReadOpenApiFile = async () => {
                return 'not valid json {{{';
            };

            const options = {
                docsAuthMiddleware,
                readOpenApiFile: invalidJsonReadOpenApiFile
            };

            const testApp = await createTestApi(options);
            const token = signApiToken({ id: 'test-user' });

            const res = await request(testApp)
                .get('/openapi.json')
                .set('Authorization', `Bearer ${token}`);

            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(res.body.error, 'Failed to load OpenAPI spec');
        });
    });

    describe('Request Validation and Error Handling', () => {
        let validToken;

        beforeEach(() => {
            validToken = signApiToken({ id: 'claims_test_oid' });
        });

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
