import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import session from 'express-session';
import request from 'supertest';
import generalRateLimiter, { generateRateLimitKey } from './index.js';

let originalAuthLimit;
let originalUnauthLimit;
let originalWindowMs;

beforeEach(() => {
    originalAuthLimit = process.env.APP_RATE_LIMIT_MAX_AUTH;
    originalUnauthLimit = process.env.APP_RATE_LIMIT_MAX_UNAUTH;
    originalWindowMs = process.env.APP_RATE_LIMIT_WINDOW_MS;
});

afterEach(() => {
    process.env.APP_RATE_LIMIT_MAX_AUTH = originalAuthLimit;
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = originalUnauthLimit;
    process.env.APP_RATE_LIMIT_WINDOW_MS = originalWindowMs;
});

/**
 * Description
 * @param {any} [limiter=generalRateLimiter] - Optional rate limiter to apply
 * @returns {Express.Application} - Express app with optional rate limiter applied
 */
function createTestApp(limiter = generalRateLimiter) {
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
    process.env.APP_RATE_LIMIT_MAX_AUTH = '2';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '100';

    const app = createTestApp();
    const oid = `auth-limit-user-${Date.now()}`;

    const res1 = await request(app).get('/test').set('x-test-oid', oid);
    const res2 = await request(app).get('/test').set('x-test-oid', oid);
    const blocked = await request(app).get('/test').set('x-test-oid', oid);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(blocked.status, 429);
    assert.deepStrictEqual(blocked.body, { error: 'Too many requests, please try again later' });
});

test('blocks requests over the unauthenticated rate limit by IP', async () => {
    process.env.APP_RATE_LIMIT_MAX_AUTH = '100';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '1';

    const app = createTestApp();
    const ip = `203.0.113.${(Date.now() % 200) + 1}`;

    const res1 = await request(app).get('/test').set('x-forwarded-for', ip);
    const blocked = await request(app).get('/test').set('x-forwarded-for', ip);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(blocked.status, 429);
    assert.deepStrictEqual(blocked.body, { error: 'Too many requests, please try again later' });
});

test('applies independent limits to different authenticated users', async () => {
    process.env.APP_RATE_LIMIT_MAX_AUTH = '1';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '100';

    const app = createTestApp();
    const user1 = `auth-user-1-${Date.now()}`;
    const user2 = `auth-user-2-${Date.now()}`;

    const user1First = await request(app).get('/test').set('x-test-oid', user1);
    const user1Blocked = await request(app).get('/test').set('x-test-oid', user1);
    const user2First = await request(app).get('/test').set('x-test-oid', user2);

    assert.strictEqual(user1First.status, 200);
    assert.strictEqual(user1Blocked.status, 429);
    assert.strictEqual(user2First.status, 200);
});

test('uses default limits when env vars are not set', async () => {
    delete process.env.APP_RATE_LIMIT_MAX_AUTH;
    delete process.env.APP_RATE_LIMIT_MAX_UNAUTH;

    const app = createTestApp();
    const unauthIp = `198.51.100.${(Date.now() % 200) + 1}`;
    const authOid = `default-auth-${Date.now()}`;

    const unauthRes = await request(app).get('/test').set('x-forwarded-for', unauthIp);
    const authRes = await request(app).get('/test').set('x-test-oid', authOid);

    assert.strictEqual(unauthRes.status, 200);
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(unauthRes.headers['x-ratelimit-limit'], '500');
    assert.strictEqual(authRes.headers['x-ratelimit-limit'], '1000');
});

test('uses configured windowMs when APP_RATE_LIMIT_WINDOW_MS is set', async () => {
    process.env.APP_RATE_LIMIT_WINDOW_MS = '100';
    process.env.APP_RATE_LIMIT_MAX_AUTH = '100';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '1';

    // Re-import module with a unique specifier so windowMs is re-evaluated from env.
    const module = await import(`./index.js?window-ms-${Date.now()}`);
    const app = createTestApp(module.default);
    const ip = `203.0.113.${(Date.now() % 200) + 1}`;

    const first = await request(app).get('/test').set('x-forwarded-for', ip);
    const blocked = await request(app).get('/test').set('x-forwarded-for', ip);
    assert.strictEqual(first.status, 200);
    assert.strictEqual(blocked.status, 429);

    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });

    const afterReset = await request(app).get('/test').set('x-forwarded-for', ip);
    assert.strictEqual(afterReset.status, 200);
});

test('uses default windowMs when APP_RATE_LIMIT_WINDOW_MS is not set', async () => {
    delete process.env.APP_RATE_LIMIT_WINDOW_MS;
    process.env.APP_RATE_LIMIT_MAX_AUTH = '100';
    process.env.APP_RATE_LIMIT_MAX_UNAUTH = '1';

    // Re-import module with a unique specifier so windowMs is re-evaluated from env.
    const module = await import(`./index.js?default-window-${Date.now()}`);
    const app = createTestApp(module.default);
    const ip = `203.0.113.${(Date.now() % 200) + 1}`;

    const first = await request(app).get('/test').set('x-forwarded-for', ip);
    const blocked = await request(app).get('/test').set('x-forwarded-for', ip);
    assert.strictEqual(first.status, 200);
    assert.strictEqual(blocked.status, 429);

    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });

    // With default window (15 minutes), client should still be blocked shortly after.
    const stillBlocked = await request(app).get('/test').set('x-forwarded-for', ip);
    assert.strictEqual(stillBlocked.status, 429);
});
