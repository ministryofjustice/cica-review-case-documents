import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createFailureRateLimiter, LoginLockoutError } from './authRateLimiter.js';

/**
 * Creates an Express application with a login endpoint protected by a failure rate limiter.
 *
 * The app exposes a POST /auth/login route that checks credentials.
 * If login fails more than the allowed number of times within the time window,
 * further attempts are blocked with a 429 response and a test-specific message.
 *
 * @returns {import('express').Express} Configured Express application instance.
 */
function createApp() {
    const app = express();
    app.use(express.json());

    const limiter = createFailureRateLimiter({ windowMs: 60_000, maxFailures: 5 });

    app.post('/auth/login', limiter, (req, res) => {
        const { username = '', password = '' } = req.body;
        const success = password === 'correct' && username;
        if (!success) {
            return res.status(401).send('Invalid credentials');
        }
        return res.redirect(302, '/');
    });

    // Test-specific error handler to catch the LoginLockoutError
    app.use((err, req, res, next) => {
        if (err instanceof LoginLockoutError) {
            return res.status(429).send('LOCKED_OUT_TEST_MESSAGE');
        }
        next(err);
    });

    return app;
}

/**
 * Sets the 'X-Forwarded-For' header on the request object to the specified IP address.
 *
 * @param {Object} req - The request object, typically an instance of a test request.
 * @param {string} ip - The IP address to set in the 'X-Forwarded-For' header.
 * @returns {Object} The modified request object with the header set.
 */
function setIp(req, ip) {
    return req.set('X-Forwarded-For', ip);
}

test('locks out after 5 failed attempts (6th returns 429)', async () => {
    const app = createApp();
    for (let i = 1; i <= 5; i++) {
        const r = await request(app)
            .post('/auth/login')
            .send({ username: 'alice', password: 'wrong' });
        assert.equal(r.status, 401);
    }
    const r6 = await request(app)
        .post('/auth/login')
        .send({ username: 'alice', password: 'wrong' });
    assert.equal(r6.status, 429);
    assert.match(r6.text, /LOCKED_OUT_TEST_MESSAGE/);
});

test('successful attempt does not consume quota (skipSuccessfulRequests)', async () => {
    const app = createApp();
    for (let i = 1; i <= 4; i++) {
        const r = await request(app).post('/auth/login').send({ username: 'bob', password: 'bad' });
        assert.equal(r.status, 401);
    }
    const success = await request(app)
        .post('/auth/login')
        .send({ username: 'bob', password: 'correct' });
    assert.equal(success.status, 302);

    const fifthFail = await request(app)
        .post('/auth/login')
        .send({ username: 'bob', password: 'bad' });
    assert.equal(fifthFail.status, 401);

    const sixthFail = await request(app)
        .post('/auth/login')
        .send({ username: 'bob', password: 'bad' });
    assert.equal(sixthFail.status, 429);
});

test('different usernames have independent limits', async () => {
    const app = createApp();
    for (let i = 1; i <= 5; i++) {
        const r = await request(app).post('/auth/login').send({ username: 'user1', password: 'x' });
        assert.equal(r.status, 401);
    }
    const locked = await request(app)
        .post('/auth/login')
        .send({ username: 'user1', password: 'x' });
    assert.equal(locked.status, 429);

    const user2 = await request(app).post('/auth/login').send({ username: 'user2', password: 'x' });
    assert.equal(user2.status, 401);
});

test('IPv6-mapped and plain IPv4 normalize to same key', async () => {
    const app = createApp();
    for (let i = 1; i <= 3; i++) {
        const r = await setIp(request(app).post('/auth/login'), '::ffff:127.0.0.1').send({
            username: 'user2',
            password: 'x'
        });
        assert.equal(r.status, 401);
    }
    for (let i = 4; i <= 5; i++) {
        const r = await setIp(request(app).post('/auth/login'), '127.0.0.1').send({
            username: 'user2',
            password: 'x'
        });
        assert.equal(r.status, 401);
    }
    const r6 = await setIp(request(app).post('/auth/login'), '127.0.0.1').send({
        username: 'user2',
        password: 'x'
    });
    assert.equal(r6.status, 429);
});

test('RateLimit-Remaining header decreases on failures', async () => {
    const app = createApp();
    for (let i = 1; i <= 5; i++) {
        const r = await request(app)
            .post('/auth/login')
            .send({ username: 'meter', password: 'bad' });
        assert.equal(r.status, 401);
        const remaining = Number(r.get('RateLimit-Remaining'));
        assert.equal(remaining, 5 - i);
    }
    const locked = await request(app)
        .post('/auth/login')
        .send({ username: 'meter', password: 'bad' });
    assert.equal(locked.status, 429);
});
