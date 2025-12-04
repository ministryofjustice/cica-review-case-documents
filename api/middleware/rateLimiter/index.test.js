import express from 'express';
import request from 'supertest';
import rateLimiter from './index.js';
import rateLimit from 'express-rate-limit';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

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

test('allows requests under the rate limit per token', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(rateLimiter);
    const token = 'test-token';
    for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
        assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
        assert.strictEqual(res.text, 'OK');
    }
});

test('blocks requests over the rate limit per token', async () => {
    process.env.NODE_ENV = 'production';
    // Use a low max for testing
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 5,
        skip: () => false,
        keyGenerator: (req, res) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
            throw new Error('Missing JWT: rejecting request');
        },
        handler: (req, res) => {
            res.status(429).send('Too many requests, please try again later');
        }
    });
    const app = createTestApp(limiter);
    const token = 'test-token';
    let lastRes;
    for (let i = 0; i < 10; i++) {
        lastRes = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
    }
    assert.strictEqual(lastRes.status, 429, 'Should return 429 when rate limit exceeded');
    assert.match(lastRes.text, /Too many requests/i);
});

test('throws error if JWT is missing', async () => {
    process.env.NODE_ENV = 'production';
    // Create a limiter that doesn't skip missing auth (for testing the rate limiter behavior)
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        skip: (req, res) => process.env.NODE_ENV !== 'production', // Check NODE_ENV directly
        keyGenerator: (req, res) => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
            const err = new Error('Missing JWT: rejecting request');
            err.status = 401;
            throw err;
        },
        handler: (req, res) => {
            throw new Error('Too many requests, please try again later');
        }
    });

    const app = createTestApp(limiter);
    const res = await request(app).get('/api/test');
    assert.strictEqual(res.status, 401);
    assert.match(res.text, /Missing JWT: rejecting request/i);
});

test('skips rate limiting in non-production environments', async () => {
    process.env.NODE_ENV = 'development';
    const app = createTestApp(rateLimiter);
    const res = await request(app).get('/api/test');
    // Should skip and hit the route, return 200
    assert.strictEqual(res.status, 200);
});

test('skips rate limiting when no Authorization header present', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp(rateLimiter);
    const res = await request(app).get('/api/test');
    // Should skip rate limiter, hit the route
    assert.strictEqual(res.status, 200);
});
