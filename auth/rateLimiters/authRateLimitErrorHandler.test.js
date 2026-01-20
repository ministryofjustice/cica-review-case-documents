/**
 * Unit tests for the rateLimitErrorHandler middleware.
 *
 * Tests:
 * - Responds with HTTP 429 and a lockout message when a RateLimitError is thrown.
 * - Passes non-rate-limit errors to the next error handler, which responds with HTTP 500.
 *
 * Mocks:
 * - Template engine service to simulate rendering lockout messages.
 *
 * Dependencies:
 * - node:test: For running tests.
 * - node:assert/strict: For assertions.
 * - express: For creating the test server.
 * - supertest: For HTTP request simulation.
 * - rateLimitErrorHandler: The middleware under test.
 * - RateLimitError: Custom error class for rate limiting.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import rateLimitErrorHandler from './authRateLimitErrorHandler.js';
import { LoginLockoutError } from './authRateLimiter.js';

/**
 * Mocks the creation of a template engine service for testing purposes.
 * Returns an object with a `render` method that generates a string containing the lockout warning.
 *
 * @param {Object} app - The Express application instance (unused in mock).
 * @returns {{ render: function(string, Object): string }} An object with a render function.
 */
function mockCreateTemplateEngineService(app) {
    return {
        render: (template, context) => {
            return `LOCKOUT:${context.lockoutWarning}`;
        }
    };
}

test('responds with 429 and lockout message for LoginLockoutError', async () => {
    const app = express();
    app.use(express.json());

    app.get('/test-lockout', (req, res, next) => {
        next(new LoginLockoutError());
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
