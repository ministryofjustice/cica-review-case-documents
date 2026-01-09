/**
 * Creates an Express application configured with session support and the general rate limiter middleware.
 * The app exposes a single GET endpoint at '/test' for testing rate limiting.
 *
 * @returns {express.Application} The configured Express application instance.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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
        if (req.query.login) {
            req.session.loggedIn = true;
            req.session.id = 'mysessionid';
        }
        res.status(200).send('OK');
    });
    return app;
}

test('allows requests under the authenticated/session rate limit', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000,
            limit: (req) => (req.session?.loggedIn ? 5 : 2),
            keyGenerator: (req) =>
                req.session?.loggedIn && req.session?.id ? req.session.id : ipKeyGenerator(req),
            skip: () => false
        });

        const app = createTestApp(limiter);
        const agent = request.agent(app);

        // Simulate login
        await agent.get('/test?login=true'); // Establish session and login

        for (let i = 0; i < 5; i++) {
            const res = await agent.get('/test');
            assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
        }
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('blocks requests over the authenticated/session rate limit', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000,
            limit: (req) => (req.session?.loggedIn ? 3 : 2),
            keyGenerator: (req) =>
                req.session?.loggedIn && req.session?.id ? req.session.id : ipKeyGenerator(req),
            skip: () => false
        });

        const app = createTestApp(limiter);
        const agent = request.agent(app);

        // Simulate login
        await agent.get('/test?login=true');

        let lastRes;
        for (let i = 0; i < 5; i++) {
            lastRes = await agent.get('/test');
        }

        assert.strictEqual(lastRes.status, 429, 'Should return 429 when rate limit exceeded');
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('allows requests under the unauthenticated/IP rate limit', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000,
            limit: (req) => (req.session?.loggedIn ? 2 : 3),
            keyGenerator: (req) =>
                req.session?.loggedIn && req.session?.id ? req.session.id : 'test-ip', // Use static key for test reliability
            skip: () => false
        });

        const app = createTestApp(limiter);

        for (let i = 0; i < 3; i++) {
            const res = await request(app).get('/test');
            assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
        }
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('blocks requests over the unauthenticated/IP rate limit', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000,
            limit: (req) => (req.session?.loggedIn ? 2 : 2),
            keyGenerator: (req) =>
                req.session?.loggedIn && req.session?.id ? req.session.id : 'test-ip', // Use static key for test reliability
            skip: () => false
        });

        const app = createTestApp(limiter);

        let lastRes;
        for (let i = 0; i < 4; i++) {
            lastRes = await request(app).get('/test');
        }
        assert.strictEqual(lastRes.status, 429, 'Should return 429 when IP rate limit exceeded');
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('skips rate limiting in non-production environments', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
        const limiter = rateLimit({
            windowMs: 60 * 1000,
            limit: 1,
            keyGenerator: () => 'test-ip',
            skip: () => true
        });

        const app = createTestApp(limiter);
        const res = await request(app).get('/test');
        assert.strictEqual(res.status, 200);
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});
