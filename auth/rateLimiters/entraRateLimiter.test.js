import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import session from 'express-session';
import request from 'supertest';
import {
    createEntraCallbackRateLimiter,
    createEntraLoginRateLimiter,
    generateEntraRateLimitKey
} from './entraRateLimiter.js';

// Config is injected into the factories, so these tests do not read or mutate
// process.env and are safe to run without process isolation.

/**
 * Builds a minimal Express app that applies the given limiter to a route.
 * @param {string} path - Route path to guard.
 * @param {import('express').RequestHandler} limiter - Rate limiter middleware.
 * @returns {import('express').Express} Configured app.
 */
function createLimiterApp(path, limiter) {
    const app = express();
    app.set('trust proxy', 1);
    app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
    app.get(path, limiter, (req, res) => res.status(200).send('ok'));
    return app;
}

test('Entra login limiter returns 429 when exceeded', async () => {
    const limiter = createEntraLoginRateLimiter({ windowMs: 60000, loginLimit: 1 });
    const app = createLimiterApp('/auth/login', limiter);

    const first = await request(app).get('/auth/login').set('X-Forwarded-For', '10.1.1.1');
    const second = await request(app).get('/auth/login').set('X-Forwarded-For', '10.1.1.1');

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.body.error, 'Too many authentication requests, please try again later');
});

test('Entra callback limiter uses independent callback threshold', async () => {
    const limiter = createEntraCallbackRateLimiter({ windowMs: 60000, callbackLimit: 1 });
    const app = createLimiterApp('/auth/callback', limiter);

    const first = await request(app).get('/auth/callback').set('X-Forwarded-For', '10.2.2.2');
    const second = await request(app).get('/auth/callback').set('X-Forwarded-For', '10.2.2.2');

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
});

test('generateEntraRateLimitKey uses express-rate-limit ipKeyGenerator with req.ip string', () => {
    const req = {
        ip: '127.0.0.1',
        ips: [],
        socket: { remoteAddress: '127.0.0.1' },
        headers: {}
    };

    const expected = ipKeyGenerator(req.ip);
    const actual = generateEntraRateLimitKey(req);

    assert.equal(actual, expected);
});

test('Entra rate limiter falls back to default config when config is not provided', async () => {
    // No config passed: the factories fall back to env / documented defaults (20/40).
    const app = express();
    app.set('trust proxy', 1);
    app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
    app.get('/auth/login', createEntraLoginRateLimiter(), (req, res) => res.status(200).send('ok'));
    app.get('/auth/callback', createEntraCallbackRateLimiter(), (req, res) =>
        res.status(200).send('ok')
    );

    const loginFirst = await request(app).get('/auth/login').set('X-Forwarded-For', '10.4.4.4');
    const loginSecond = await request(app).get('/auth/login').set('X-Forwarded-For', '10.4.4.4');

    const callbackFirst = await request(app)
        .get('/auth/callback')
        .set('X-Forwarded-For', '10.5.5.5');
    const callbackSecond = await request(app)
        .get('/auth/callback')
        .set('X-Forwarded-For', '10.5.5.5');

    // Default limits (20/40) should allow initial repeated requests.
    assert.equal(loginFirst.status, 200);
    assert.equal(loginSecond.status, 200);
    assert.equal(callbackFirst.status, 200);
    assert.equal(callbackSecond.status, 200);
});

test('Entra login limiter accepts a partial config and fills the rest from defaults', async () => {
    // Only loginLimit is provided; windowMs must fall back to the default (15 min)
    // rather than being forwarded as undefined to express-rate-limit.
    const limiter = createEntraLoginRateLimiter({ loginLimit: 1 });
    const app = createLimiterApp('/auth/login', limiter);

    const first = await request(app).get('/auth/login').set('X-Forwarded-For', '10.6.6.6');
    const second = await request(app).get('/auth/login').set('X-Forwarded-For', '10.6.6.6');

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);

    // With the default (long) window, a short wait does not reset the limit.
    await new Promise((resolve) => {
        setTimeout(resolve, 150);
    });
    const third = await request(app).get('/auth/login').set('X-Forwarded-For', '10.6.6.6');
    assert.equal(third.status, 429);
});
