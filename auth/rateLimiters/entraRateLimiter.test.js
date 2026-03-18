import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

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
        app.set('trust proxy', true);
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
        app.set('trust proxy', true);
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
        app.set('trust proxy', true);
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
