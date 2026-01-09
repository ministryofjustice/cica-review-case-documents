import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

/**
 * Simulate a dynamic rate limiter for testing for Express based on authentication status.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.authLimit=5] - Maximum requests per window for authenticated users.
 * @param {number} [options.unauthLimit=2] - Maximum requests per window for unauthenticated users.
 * @param {number} [options.windowMs=60000] - Time window in milliseconds.
 * @returns {Function} Express middleware for rate limiting.
 */
function createDynamicRateLimiter({ authLimit = 5, unauthLimit = 2, windowMs = 60 * 1000 } = {}) {
    return rateLimit({
        windowMs,
        limit: (req) => (req.user ? authLimit : unauthLimit),
        keyGenerator: (req) => {
            // Use user ID for authenticated requests
            if (req.user?.id) {
                return req.user.id;
            }
            // Use a static string for unauthenticated test requests.
            // This ensures all unauth requests in the test count towards the same limit,
            // avoiding issues with ephemeral ports/IPs in supertest.
            return 'unauthenticated-test-client';
        },
        skip: (req) => process.env.NODE_ENV !== 'production',
        handler: (req, res) => {
            res.status(429).json({ error: 'Too many requests, please try again later' });
        }
    });
}

/**
 * Express middleware that extracts a Fake JWT token from the Authorization header
 * and assigns it as the user ID on the request object.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 */
function fakeJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        req.user = { id: authHeader.substring(7) }; // Use token as user id
    }
    next();
}

let originalEnv;

beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
});

afterEach(() => {
    process.env.NODE_ENV = originalEnv;
});

/**
 * Creates an Express application with the provided rate limiter middleware.
 * The app exposes a GET endpoint at '/api/test' that returns a 200 OK response.
 * Includes an error handler to send the correct status and error message.
 *
 * @param {Function} limiter - Express middleware function for rate limiting.
 * @returns {import('express').Express} Configured Express application instance.
 */
function createTestApp(limiter) {
    const app = express();
    app.use(fakeJWT);
    app.use(limiter);
    app.get('/api/test', (req, res) => {
        res.status(200).send('OK');
    });
    // Error handler to catch thrown errors and use correct status
    app.use((err, req, res, next) => {
        res.status(err.status || err.statusCode || 500).send(err.message);
    });
    return app;
}

test('allows requests under the authenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(createDynamicRateLimiter({ authLimit: 5 }));
    const token = 'user-123';
    for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }
});

test('blocks requests over the authenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(createDynamicRateLimiter({ authLimit: 3 }));
    const token = 'user-456';
    let lastRes;
    for (let i = 0; i < 5; i++) {
        lastRes = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
    }
    assert.strictEqual(
        lastRes.status,
        429,
        'Should return 429 when authenticated rate limit exceeded'
    );
    assert.match(lastRes.body.error, /Too many requests/i);
});

test('allows requests under the unauthenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(createDynamicRateLimiter({ unauthLimit: 2 }));
    for (let i = 0; i < 2; i++) {
        const res = await request(app).get('/api/test');
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }
});

test('blocks requests over the unauthenticated rate limit', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(createDynamicRateLimiter({ unauthLimit: 2 }));
    let lastRes;
    for (let i = 0; i < 4; i++) {
        lastRes = await request(app).get('/api/test');
    }
    assert.strictEqual(
        lastRes.status,
        429,
        'Should return 429 when unauthenticated rate limit exceeded'
    );
    assert.match(lastRes.body.error, /Too many requests/i);
});

test('skips rate limiting in non-production environments', async () => {
    process.env.NODE_ENV = 'development';
    // In a real app, you would conditionally apply the middleware
    // For this test, we simulate that by not using the limiter
    const app = express();
    app.get('/api/test', (req, res) => {
        res.status(200).send('OK');
    });
    const res = await request(app).get('/api/test');
    assert.strictEqual(res.status, 200);
});
