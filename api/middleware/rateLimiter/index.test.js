import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createDynamicRateLimiter from './index.js';

let originalEnv;
let originalAuthLimit;
let originalUnauthLimit;

/**
 * Creates an Express application configured with the rate limiter middleware for testing.
 *
 * The app includes:
 * - Middleware to extract user ID from Authorization header (Bearer token format)
 * - The dynamic rate limiter middleware
 * - A GET endpoint at /api/test that returns a 200 OK response
 *
 * This single instance is reused across all tests to maintain consistent state
 * in the rate limiter's internal store.
 *
 * @returns {import('express').Express} Configured Express application instance
 */
function createTestApp(preMiddleware) {
    const app = express();

    // Allow tests to inject middleware that runs before auth/rate-limiter
    // (e.g. to simulate a session store setting `req.session.entraUser`)
    if (preMiddleware) {
        if (Array.isArray(preMiddleware)) {
            preMiddleware.forEach((m) => {
                app.use(m);
            });
        } else {
            app.use(preMiddleware);
        }
    }

    // Middleware to extract user from Authorization header
    app.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                req.decodedToken = jwt.verify(token, process.env.APP_JWT_SECRET, {
                    issuer: process.env.APP_API_JWT_ISSUER,
                    audience: process.env.APP_API_JWT_AUDIENCE,
                    algorithms: ['HS256']
                });
            } catch {
                req.decodedToken = { id: token };
            }
        }
        next();
    });

    app.use(createDynamicRateLimiter());

    app.get('/api/test', (req, res) => {
        res.status(200).json({ ok: true });
    });

    return app;
}

const app = createTestApp();

beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    originalAuthLimit = process.env.API_RATE_LIMIT_MAX_AUTH;
    originalUnauthLimit = process.env.API_RATE_LIMIT_MAX_UNAUTH;
});

afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalAuthLimit !== undefined) {
        process.env.API_RATE_LIMIT_MAX_AUTH = originalAuthLimit;
    } else {
        delete process.env.API_RATE_LIMIT_MAX_AUTH;
    }
    if (originalUnauthLimit !== undefined) {
        process.env.API_RATE_LIMIT_MAX_UNAUTH = originalUnauthLimit;
    } else {
        delete process.env.API_RATE_LIMIT_MAX_UNAUTH;
    }
});

test('Blocks requests over the authenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    const rateLimit = 5;
    process.env.API_RATE_LIMIT_MAX_AUTH = rateLimit;
    const token = 'rate-user-1'; // Use a simple string as token for testing

    for (let i = 0; i < rateLimit; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    const blocked = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(blocked.status, 429, 'Request should be blocked');
});

test('returns 429 status with correct error message on unauthenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT_MAX_UNAUTH = '1';

    // First request succeeds
    const res1 = await request(app).get('/api/test');
    assert.strictEqual(res1.status, 200);

    // Second request should return 429 with error message
    const res2 = await request(app).get('/api/test');
    assert.strictEqual(res2.status, 429);
    assert.match(res2.body.error, /Too many requests/);
});

test('different authenticated users have separate rate limits', async () => {
    process.env.NODE_ENV = 'production';
    const rateLimit = 2;
    process.env.API_RATE_LIMIT_MAX_AUTH = rateLimit;

    // User 1 makes 2 requests
    for (let i = 0; i < rateLimit; i++) {
        const token = 'user-1'; // Use a simple string as token for testing;
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200);
    }

    // User 1's 3rd request should be blocked
    const token = 'user-1'; // Use a simple string as token for testing;
    let res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 429);

    // User 2 can still make requests (separate limit per user)
    res = await request(app).get('/api/test').set('Authorization', 'Bearer user-2');
    assert.strictEqual(res.status, 200);
});

test('Blocks requests over the authenticated rate limit for session-based authentication, web browser', async () => {
    process.env.NODE_ENV = 'production';

    const rateLimit = 5;
    process.env.API_RATE_LIMIT_MAX_AUTH = rateLimit;

    // Create an app that simulates a browser session by populating req.session.entraUser.oid
    const sessionMiddleware = (req, res, next) => {
        req.session = req.session || {};
        req.session.entraUser = { oid: 'session-rate-user-1' };
        next();
    };

    const appWithSession = createTestApp(sessionMiddleware);

    // Make requests without an Authorization header; keying should use session.entraUser.oid
    for (let i = 0; i < rateLimit; i++) {
        const res = await request(appWithSession).get('/api/test');
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    const blocked = await request(appWithSession).get('/api/test');
    assert.strictEqual(blocked.status, 429, 'Request should be blocked');
});

test('Web and API limits are calculated independently', async () => {
    process.env.NODE_ENV = 'production';

    const rateLimit = 5;
    process.env.API_RATE_LIMIT_MAX_AUTH = rateLimit;

    // Create an app that simulates a browser session by populating req.session.entraUser.oid
    const sessionMiddleware = (req, res, next) => {
        req.session = req.session || {};
        req.session.entraUser = { oid: 'session-rate-user-1' };
        next();
    };

    const appWithSession = createTestApp(sessionMiddleware);

    // Make requests without an Authorization header; keying should use session.entraUser.oid as cache
    for (let i = 0; i < rateLimit; i++) {
        const res = await request(appWithSession).get('/api/test');
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    // Make requests without an API token header; keying should use the token string as cache
    const token = 'api-request-identifier'; // Use a simple string as token for testing
    for (let i = 0; i < rateLimit; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200);
    }

    const blockedSessionRequest = await request(appWithSession).get('/api/test');
    assert.strictEqual(blockedSessionRequest.status, 429, 'Request should be blocked');

    const blockedAPIRequest = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(blockedAPIRequest.status, 429, 'Request should be blocked');
});
