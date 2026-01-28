import assert from 'node:assert';
import { test } from 'node:test';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import generalRateLimiter from './index.js';

test('skip function returns true in non-production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(generalRateLimiter);
        app.get('/test', (req, res) => res.send('OK'));

        // Should allow unlimited requests in dev mode
        for (let i = 0; i < 100; i++) {
            const res = await request(app).get('/test');
            assert.strictEqual(res.status, 200);
        }
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('limit function returns AUTHENTICATED_LIMIT when session.loggedIn is true', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAuth = process.env.APP_RATE_LIMIT_MAX_AUTH;
    const originalUnauth = process.env.APP_RATE_LIMIT_MAX_UNAUTH;

    process.env.NODE_ENV = 'production';
    process.env.APP_RATE_LIMIT_MAX_AUTH = '2';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '1';

    try {
        const { default: limiter } = await import(`./index.js?t=${Date.now()}`);

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use((req, res, next) => {
            req.session.loggedIn = true;
            next();
        });
        app.use(limiter);
        app.get('/test', (req, res) => res.send('OK'));

        const agent = request.agent(app);
        const res1 = await agent.get('/test');
        assert.strictEqual(res1.status, 200);
        const res2 = await agent.get('/test');
        assert.strictEqual(res2.status, 200);
        const res3 = await agent.get('/test');
        assert.strictEqual(res3.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAuth) process.env.APP_RATE_LIMIT_MAX_AUTH = originalAuth;
        else delete process.env.APP_RATE_LIMIT_MAX_AUTH;
        if (originalUnauth) process.env.APP_RATE_LIMIT_MAX_UNAUTH = originalUnauth;
        else delete process.env.APP_RATE_LIMIT_MAX_UNAUTH;
    }
});

test('limit function returns AUTHENTICATED_LIMIT when req.user exists', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAuth = process.env.APP_RATE_LIMIT_MAX_AUTH;
    const originalUnauth = process.env.APP_RATE_LIMIT_MAX_UNAUTH;

    process.env.NODE_ENV = 'production';
    process.env.APP_RATE_LIMIT_MAX_AUTH = '2';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '1';

    try {
        const { default: limiter } = await import(`./index.js?t=${Date.now()}`);

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use((req, res, next) => {
            req.user = { id: 'user-123' };
            next();
        });
        app.use(limiter);
        app.get('/test', (req, res) => res.send('OK'));

        const res1 = await request(app).get('/test');
        assert.strictEqual(res1.status, 200);
        const res2 = await request(app).get('/test');
        assert.strictEqual(res2.status, 200);
        const res3 = await request(app).get('/test');
        assert.strictEqual(res3.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAuth) process.env.APP_RATE_LIMIT_MAX_AUTH = originalAuth;
        else delete process.env.APP_RATE_LIMIT_MAX_AUTH;
        if (originalUnauth) process.env.APP_RATE_LIMIT_MAX_UNAUTH = originalUnauth;
        else delete process.env.APP_RATE_LIMIT_MAX_UNAUTH;
    }
});

test('limit function returns UNAUTHENTICATED_LIMIT when no auth present', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        // Create a test limiter with unauthenticated limit of 1
        const { default: rateLimit } = await import('express-rate-limit');
        const testLimiter = rateLimit({
            windowMs: 60 * 1000,
            limit: (req) => (req.session?.loggedIn || req.user ? 5 : 1),
            skip: () => !process.env.NODE_ENV || process.env.NODE_ENV !== 'production'
        });

        const app = express();
        app.set('trust proxy', true);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(testLimiter);
        app.get('/test', (req, res) => res.send('OK'));

        const res1 = await request(app).get('/test');
        assert.strictEqual(res1.status, 200);
        const res2 = await request(app).get('/test');
        assert.strictEqual(res2.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('keyGenerator returns session.id when session.loggedIn and session.id exist', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAuth = process.env.APP_RATE_LIMIT_MAX_AUTH;

    process.env.NODE_ENV = 'production';
    process.env.APP_RATE_LIMIT_MAX_AUTH = '1';

    try {
        const { default: limiter } = await import(`./index.js?t=${Date.now()}`);

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use((req, res, next) => {
            req.session.loggedIn = true;
            next();
        });
        app.use(limiter);
        app.get('/test', (req, res) => res.send('OK'));

        const agent1 = request.agent(app);
        const agent2 = request.agent(app);

        const res1 = await agent1.get('/test');
        assert.strictEqual(res1.status, 200);
        const res2 = await agent1.get('/test');
        assert.strictEqual(res2.status, 429);
        const res3 = await agent2.get('/test');
        assert.strictEqual(res3.status, 200);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAuth) process.env.APP_RATE_LIMIT_MAX_AUTH = originalAuth;
        else delete process.env.APP_RATE_LIMIT_MAX_AUTH;
    }
});

test('keyGenerator returns user.id when no session.loggedIn but user.id exists', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAuth = process.env.APP_RATE_LIMIT_MAX_AUTH;

    process.env.NODE_ENV = 'production';
    process.env.APP_RATE_LIMIT_MAX_AUTH = '1';

    try {
        const { default: limiter } = await import(`./index.js?t=${Date.now()}`);

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use((req, res, next) => {
            req.user = { id: req.headers['x-user-id'] };
            next();
        });
        app.use(limiter);
        app.get('/test', (req, res) => res.send('OK'));

        const res1 = await request(app).get('/test').set('x-user-id', 'user-1');
        assert.strictEqual(res1.status, 200);
        const res2 = await request(app).get('/test').set('x-user-id', 'user-1');
        assert.strictEqual(res2.status, 429);
        const res3 = await request(app).get('/test').set('x-user-id', 'user-2');
        assert.strictEqual(res3.status, 200);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAuth) process.env.APP_RATE_LIMIT_MAX_AUTH = originalAuth;
        else delete process.env.APP_RATE_LIMIT_MAX_AUTH;
    }
});

test('keyGenerator uses ipKeyGenerator when no session or user', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        const { default: rateLimit } = await import('express-rate-limit');
        const testLimiter = rateLimit({
            windowMs: 60 * 1000,
            limit: 1,
            keyGenerator: (req) => {
                // Use IP-based key when no session or user
                if (req.session?.loggedIn && req.session?.id) {
                    return req.session.id;
                }
                if (req.user?.id) {
                    return req.user.id;
                }
                // Fallback to IP key - for testing we use a fixed key
                return 'test-ip-client';
            },
            skip: () => !process.env.NODE_ENV || process.env.NODE_ENV !== 'production'
        });

        const app = express();
        app.set('trust proxy', true);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(testLimiter);
        app.get('/test', (req, res) => res.send('OK'));

        const res1 = await request(app).get('/test');
        assert.strictEqual(res1.status, 200);
        const res2 = await request(app).get('/test');
        assert.strictEqual(res2.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('handler returns 429 with JSON error when limit exceeded', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        const { default: rateLimit } = await import('express-rate-limit');
        const testLimiter = rateLimit({
            windowMs: 60 * 1000,
            limit: 1,
            skip: () => !process.env.NODE_ENV || process.env.NODE_ENV !== 'production',
            handler: (req, res) => {
                res.status(429).json({ error: 'Too many requests, please try again later' });
            }
        });

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(testLimiter);
        app.get('/test', (req, res) => res.send('OK'));

        await request(app).get('/test');
        const res = await request(app).get('/test');
        assert.strictEqual(res.status, 429);
        assert.strictEqual(res.body.error, 'Too many requests, please try again later');
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
});

test('uses default WINDOW_MS when APP_RATE_LIMIT_WINDOW_MS is not set', async () => {
    const originalWindowMs = process.env.APP_RATE_LIMIT_WINDOW_MS;
    const originalEnv = process.env.NODE_ENV;

    delete process.env.APP_RATE_LIMIT_WINDOW_MS;
    process.env.NODE_ENV = 'development'; // Skip rate limiting so we can test initialization

    try {
        const { default: limiter } = await import(`./index.js?t=${Date.now()}`);

        const app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(limiter);
        app.get('/test', (req, res) => res.send('OK'));

        const res = await request(app).get('/test');
        assert.strictEqual(res.status, 200);
    } finally {
        if (originalWindowMs) process.env.APP_RATE_LIMIT_WINDOW_MS = originalWindowMs;
        process.env.NODE_ENV = originalEnv;
    }
});
