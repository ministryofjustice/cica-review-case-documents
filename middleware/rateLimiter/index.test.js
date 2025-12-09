/**
 * Creates an Express application configured with session support and the general rate limiter middleware.
 * The app exposes a single GET endpoint at '/test' for testing rate limiting.
 *
 * @returns {express.Application} The configured Express application instance.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import request from 'supertest';

/**
 * Creates an Express application configured with session middleware and a general rate limiter.
 * The app exposes a single GET endpoint at '/test' that responds with a 200 status and 'OK'.
 *
 * @param {Object} limiter - The rate limiter middleware to use
 * @returns {import('express').Express} The configured Express application instance.
 */
function createTestApp(limiter) {
    const app = express();
    app.use(
        session({
            secret: 'testsecret',
            resave: false,
            saveUninitialized: true
        })
    );
    app.use(limiter);
    app.get('/test', (req, res) => {
        res.status(200).send('OK');
    });
    return app;
}

test('allows requests under the rate limit per session', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 100,
            skip: (req, res) => !process.env.NODE_ENV === 'production',
            keyGenerator: (req) => req.session?.id || 'no-session'
        });

        const app = createTestApp(limiter);
        const agent = request.agent(app);

        for (let i = 0; i < 5; i++) {
            const res = await agent.get('/test');
            assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
            assert.strictEqual(res.text, 'OK');
        }
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('blocks requests over the rate limit per session', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 5, // Low limit for testing
            skip: (req, res) => !process.env.NODE_ENV === 'production',
            keyGenerator: (req) => req.session?.id || 'no-session',
            standardHeaders: false,
            legacyHeaders: false
        });

        const app = createTestApp(limiter);
        const agent = request.agent(app);

        let lastRes;
        for (let i = 0; i < 10; i++) {
            lastRes = await agent.get('/test');
        }

        assert.strictEqual(lastRes.status, 429, 'Should return 429 when rate limit exceeded');
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});
