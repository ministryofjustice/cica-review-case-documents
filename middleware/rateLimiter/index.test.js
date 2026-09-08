import assert from 'node:assert';
import { test } from 'node:test';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import session from 'express-session';
import request from 'supertest';
import createGeneralRateLimiter, { generateRateLimitKey } from './index.js';

// Config is injected into the factory, so these tests do not read or mutate
// process.env and are safe to run without process isolation.

/**
 * Creates an Express app configured with session support and the provided rate limiter.
 * @param {import('express').RequestHandler} limiter - Rate limiter middleware to apply.
 * @returns {import('express').Express} Configured Express application instance.
 */
function createTestApp(limiter) {
    const app = express();
    app.set('trust proxy', 1);

    app.use(
        session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: true
        })
    );

    // Test helper: simulate authenticated browser sessions via request headers.
    app.use((req, res, next) => {
        const oid = req.get('x-test-oid');
        if (oid) {
            req.session.loggedIn = true;
            req.session.entraUser = { oid };
        }
        next();
    });

    app.use(limiter);

    app.get('/test', (req, res) => {
        res.status(200).json({ ok: true });
    });

    return app;
}

test('generateRateLimitKey uses entra oid for authenticated requests', () => {
    const req = {
        ip: '203.0.113.1',
        session: {
            loggedIn: true,
            entraUser: { oid: 'oid-123' }
        }
    };

    assert.strictEqual(generateRateLimitKey(req), 'oid:oid-123');
});

test('generateRateLimitKey falls back to IP when unauthenticated', () => {
    const req = {
        ip: '198.51.100.10',
        session: { loggedIn: false, entraUser: { oid: 'oid-ignored' } }
    };

    assert.strictEqual(generateRateLimitKey(req), ipKeyGenerator(req.ip));
});

test('generateRateLimitKey falls back to IP when authenticated user has no oid', () => {
    const req = {
        ip: '198.51.100.11',
        session: { loggedIn: true, entraUser: {} }
    };

    assert.strictEqual(generateRateLimitKey(req), ipKeyGenerator(req.ip));
});

test('blocks requests over the authenticated rate limit', async () => {
    const app = createTestApp(createGeneralRateLimiter({ authLimit: 2, unauthLimit: 100 }));

    const res1 = await request(app).get('/test').set('x-test-oid', 'auth-limit-user');
    const res2 = await request(app).get('/test').set('x-test-oid', 'auth-limit-user');
    const blocked = await request(app).get('/test').set('x-test-oid', 'auth-limit-user');

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(blocked.status, 429);
    assert.deepStrictEqual(blocked.body, { error: 'Too many requests, please try again later' });
});

test('blocks requests over the unauthenticated rate limit by IP', async () => {
    const app = createTestApp(createGeneralRateLimiter({ authLimit: 100, unauthLimit: 1 }));

    const res1 = await request(app).get('/test').set('x-forwarded-for', '203.0.113.10');
    const blocked = await request(app).get('/test').set('x-forwarded-for', '203.0.113.10');

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(blocked.status, 429);
    assert.deepStrictEqual(blocked.body, { error: 'Too many requests, please try again later' });
});

test('applies independent limits to different authenticated users', async () => {
    const app = createTestApp(createGeneralRateLimiter({ authLimit: 1, unauthLimit: 100 }));

    const user1First = await request(app).get('/test').set('x-test-oid', 'independent-user-1');
    const user1Blocked = await request(app).get('/test').set('x-test-oid', 'independent-user-1');
    const user2First = await request(app).get('/test').set('x-test-oid', 'independent-user-2');

    assert.strictEqual(user1First.status, 200);
    assert.strictEqual(user1Blocked.status, 429);
    assert.strictEqual(user2First.status, 200);
});

test('uses default limits when config is not provided', async () => {
    // No config passed: the factory falls back to env / documented defaults.
    const app = createTestApp(createGeneralRateLimiter());

    const unauthRes = await request(app).get('/test').set('x-forwarded-for', '198.51.100.20');
    const authRes = await request(app).get('/test').set('x-test-oid', 'default-auth-user');

    assert.strictEqual(unauthRes.status, 200);
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(unauthRes.headers['x-ratelimit-limit'], '500');
    assert.strictEqual(authRes.headers['x-ratelimit-limit'], '1000');
});

test('uses configured windowMs so the limit resets after the window elapses', async () => {
    const app = createTestApp(
        createGeneralRateLimiter({ windowMs: 100, authLimit: 100, unauthLimit: 1 })
    );

    const first = await request(app).get('/test').set('x-forwarded-for', '203.0.113.30');
    const blocked = await request(app).get('/test').set('x-forwarded-for', '203.0.113.30');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(blocked.status, 429);

    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });

    const afterReset = await request(app).get('/test').set('x-forwarded-for', '203.0.113.30');
    assert.strictEqual(afterReset.status, 200);
});

test('uses a long default window so the limit does not reset quickly', async () => {
    // Default window (15 minutes) means a blocked client stays blocked shortly after.
    const app = createTestApp(createGeneralRateLimiter({ authLimit: 100, unauthLimit: 1 }));

    const first = await request(app).get('/test').set('x-forwarded-for', '203.0.113.40');
    const blocked = await request(app).get('/test').set('x-forwarded-for', '203.0.113.40');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(blocked.status, 429);

    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });

    const stillBlocked = await request(app).get('/test').set('x-forwarded-for', '203.0.113.40');
    assert.strictEqual(stillBlocked.status, 429);
});

test('accepts a partial config and fills the rest from defaults', async () => {
    // Only unauthLimit is provided; windowMs must fall back to the default rather
    // than being forwarded as undefined to express-rate-limit.
    const app = createTestApp(createGeneralRateLimiter({ unauthLimit: 1 }));

    const first = await request(app).get('/test').set('x-forwarded-for', '198.51.100.99');
    const blocked = await request(app).get('/test').set('x-forwarded-for', '198.51.100.99');

    assert.strictEqual(first.status, 200);
    assert.strictEqual(blocked.status, 429);

    // With the default (long) window, a short wait does not reset the limit.
    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });
    const stillBlocked = await request(app).get('/test').set('x-forwarded-for', '198.51.100.99');
    assert.strictEqual(stillBlocked.status, 429);
});
