import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
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
            req.user = { username: authHeader.substring(7) };
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
    process.env.API_RATE_LIMIT_MAX_AUTH = '5';
    const token = signApiToken({ username: 'rate-user-1' });

    for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    const blocked = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(blocked.status, 429, 'Request should be blocked');
});

test('returns 429 status with correct error message on rate limit', async () => {
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
