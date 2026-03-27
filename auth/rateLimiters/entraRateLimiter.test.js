import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import session from 'express-session';
import request from 'supertest';
import { generateEntraRateLimitKey } from './entraRateLimiter.js';

test('Entra rate limiter applies outside production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalWindow = process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
    const originalLoginMax = process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;

    process.env.NODE_ENV = 'development';
    process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN = '1';

    try {
        const { entraLoginRateLimiter } = await import(`./entraRateLimiter.js?t=${Date.now()}`);
        const app = express();
        app.set('trust proxy', 1);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(entraLoginRateLimiter);
        app.get('/auth/login', (req, res) => res.status(200).send('ok'));

        const first = await request(app).get('/auth/login').set('X-Forwarded-For', '10.9.9.9');
        const second = await request(app).get('/auth/login').set('X-Forwarded-For', '10.9.9.9');

        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalWindow === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = originalWindow;
        }
        if (originalLoginMax === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN = originalLoginMax;
        }
    }
});

test('Entra login limiter applies in production and returns 429 when exceeded', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalWindow = process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
    const originalLoginMax = process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;

    process.env.NODE_ENV = 'production';
    process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN = '1';

    try {
        const { entraLoginRateLimiter } = await import(`./entraRateLimiter.js?t=${Date.now()}`);
        const app = express();
        app.set('trust proxy', 1);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(entraLoginRateLimiter);
        app.get('/auth/login', (req, res) => res.status(200).send('ok'));

        const first = await request(app).get('/auth/login').set('X-Forwarded-For', '10.1.1.1');
        const second = await request(app).get('/auth/login').set('X-Forwarded-For', '10.1.1.1');

        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
        assert.equal(second.body.error, 'Too many authentication requests, please try again later');
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalWindow === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = originalWindow;
        }
        if (originalLoginMax === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN = originalLoginMax;
        }
    }
});

test('Entra callback limiter uses independent callback threshold', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalWindow = process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
    const originalCallbackMax = process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK;

    process.env.NODE_ENV = 'production';
    process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK = '1';

    try {
        const { entraCallbackRateLimiter } = await import(`./entraRateLimiter.js?t=${Date.now()}`);
        const app = express();
        app.set('trust proxy', 1);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
        app.use(entraCallbackRateLimiter);
        app.get('/auth/callback', (req, res) => res.status(200).send('ok'));

        const first = await request(app).get('/auth/callback').set('X-Forwarded-For', '10.2.2.2');
        const second = await request(app).get('/auth/callback').set('X-Forwarded-For', '10.2.2.2');

        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalWindow === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = originalWindow;
        }
        if (originalCallbackMax === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK = originalCallbackMax;
        }
    }
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

test('Entra rate limiter falls back to default config when env vars are unset', async () => {
    const originalWindow = process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
    const originalLoginMax = process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;
    const originalCallbackMax = process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK;

    delete process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
    delete process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;
    delete process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK;

    try {
        const { entraLoginRateLimiter, entraCallbackRateLimiter } = await import(
            `./entraRateLimiter.js?t=${Date.now()}`
        );
        const app = express();
        app.set('trust proxy', 1);
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));

        app.get('/auth/login', entraLoginRateLimiter, (req, res) => res.status(200).send('ok'));
        app.get('/auth/callback', entraCallbackRateLimiter, (req, res) =>
            res.status(200).send('ok')
        );

        const loginFirst = await request(app).get('/auth/login').set('X-Forwarded-For', '10.4.4.4');
        const loginSecond = await request(app)
            .get('/auth/login')
            .set('X-Forwarded-For', '10.4.4.4');

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
    } finally {
        if (originalWindow === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS = originalWindow;
        }
        if (originalLoginMax === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN = originalLoginMax;
        }
        if (originalCallbackMax === undefined) {
            delete process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK;
        } else {
            process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK = originalCallbackMax;
        }
    }
});
