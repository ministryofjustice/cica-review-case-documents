import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import rateLimitErrorHandler from './rateLimitErrorHandler.js';
import { RateLimitError } from '../auth/rateLimiter.js';

// Mock template engine service
function mockCreateTemplateEngineService(app) {
    return {
        render: (template, context) => {
            return `LOCKOUT:${context.lockoutWarning}`;
        }
    };
}

test('responds with 429 and lockout message for RateLimitError', async () => {
    const app = express();
    app.use(express.json());

    app.get('/test-lockout', (req, res, next) => {
        next(new RateLimitError());
    });

    app.use(rateLimitErrorHandler(app, mockCreateTemplateEngineService));

    const res = await request(app).get('/test-lockout');
    assert.equal(res.status, 429);
    assert.match(
        res.text,
        /LOCKOUT:You have been locked out for 2 hours due to too many failed attempts/
    );
});

test('passes non-rate-limit errors to next error handler', async () => {
    const app = express();
    app.use(express.json());

    app.get('/test-generic', (req, res, next) => {
        next(new Error('Generic error'));
    });

    app.use(rateLimitErrorHandler(app, mockCreateTemplateEngineService));

    app.use((err, req, res, next) => {
        res.status(500).send(`GENERIC:${err.message}`);
    });

    const res = await request(app).get('/test-generic');
    assert.equal(res.status, 500);
    assert.match(res.text, /GENERIC:Generic error/);
});
