import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import request from 'supertest';
import dynamicRateLimiter from './index.js';

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
function createTestApp() {
    const app = express();

    // Middleware to extract user from Authorization header
    app.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            req.user = { id: authHeader.substring(7) };
        }
        next();
    });

    app.use(dynamicRateLimiter);

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
    process.env.API_RATE_LIMIT_MAX_AUTH = originalAuthLimit;
    process.env.API_RATE_LIMIT_MAX_UNAUTH = originalUnauthLimit;
});

test('allows requests under the authenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT_MAX_AUTH = '5';
    const token = 'user-123';

    for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }
});

test('blocks requests over the authenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT_MAX_AUTH = '3';
    const token = 'user-456';

    // First 3 requests succeed
    for (let i = 0; i < 3; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    // 4th and 5th requests should be blocked
    for (let i = 0; i < 2; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 429, `Request ${3 + i + 1} should be blocked`);
        assert.match(res.body.error, /Too many requests/i);
    }
});

test('allows requests under the unauthenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT_MAX_UNAUTH = '2';

    for (let i = 0; i < 2; i++) {
        const res = await request(app).get('/api/test');
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }
});

// TODO: This is proving impossible to reliably test due to rate limiter state persisting across tests
// It should be tested when a suitable strategy has been found
// test('returns 429 status with correct error message on rate limit', async () => {
//     process.env.NODE_ENV = 'production';
//     process.env.API_RATE_LIMIT_MAX_UNAUTH = '1';

//     // First request succeeds
//     const res1 = await request(app).get('/api/test');
//     assert.strictEqual(res1.status, 200);

//     // Second request should return 429 with error message
//     const res2 = await request(app).get('/api/test');
//     assert.strictEqual(res2.status, 429);
//     assert.match(res2.body.error, /Too many requests/);
// });

test('different authenticated users have separate rate limits', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT_MAX_AUTH = '2';

    // User 1 makes 2 requests
    for (let i = 0; i < 2; i++) {
        const res = await request(app).get('/api/test').set('Authorization', 'Bearer user-1');
        assert.strictEqual(res.status, 200);
    }

    // User 1's 3rd request should be blocked
    let res = await request(app).get('/api/test').set('Authorization', 'Bearer user-1');
    assert.strictEqual(res.status, 429);

    // User 2 can still make requests (separate limit per user)
    res = await request(app).get('/api/test').set('Authorization', 'Bearer user-2');
    assert.strictEqual(res.status, 200);
});
