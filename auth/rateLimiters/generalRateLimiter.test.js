import express from 'express';
import session from 'express-session';
import request from 'supertest';
import generalRateLimiter from './generalRateLimiter.js';
import { test } from 'node:test';
import assert from 'node:assert';

function createTestApp() {
    const app = express();
    app.use(
        session({
            secret: 'testsecret',
            resave: false,
            saveUninitialized: true
        })
    );
    app.use(generalRateLimiter);
    app.get('/test', (req, res) => {
        res.status(200).send('OK');
    });
    return app;
}

test('allows requests under the rate limit per session', async () => {
    const app = createTestApp();
    const agent = request.agent(app); // Use agent to persist session
    for (let i = 0; i < 5; i++) {
        const res = await agent.get('/test');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.text, 'OK');
    }
});

test('blocks requests over the rate limit per session', async () => {
    const app = createTestApp();
    const agent = request.agent(app); // Use agent to persist session
    let lastRes;
    for (let i = 0; i < 101; i++) {
        lastRes = await agent.get('/test');
    }
    assert.strictEqual(lastRes.status, 429);
    assert.match(lastRes.text, /Too many requests/i);
});
