/**
 * Unit tests for the errorHandler middleware.
 *
 * These tests verify that the errorHandler:
 * - Logs and responds correctly for a 400 malformed JSON error.
 * - Logs and responds correctly for unhandled server errors (500).
 * - Logs warn-level for known 4xx errors (e.g., UnauthorizedError).
 *
 * @file index.test.js
 * @module errorHandler
 * @requires node:assert/strict
 * @requires node:test
 * @requires ./index.js
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import errorHandler from './index.js';

/**
 * Creates an in-memory logger for capturing log messages during testing.
 *
 * @returns {{
 *   logs: Array<{ level: string, obj: any, msg: string }>,
 *   logger: {
 *     info: Function,
 *     warn: Function,
 *     error: Function
 *   }
 * }} An object containing the logs array and a logger with info, warn, and error methods.
 */
function createMemoryLogger() {
    const logs = [];
    return {
        logs,
        logger: {
            info: mock.fn((obj, msg) => logs.push({ level: 'info', obj, msg })),
            warn: mock.fn((obj, msg) => logs.push({ level: 'warn', obj, msg })),
            error: mock.fn((obj, msg) => logs.push({ level: 'error', obj, msg }))
        }
    };
}

describe('errorHandler', () => {
    it('Should handle array of validation errors correctly', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'must be a string',
                    path: 'body.name',
                    errorCode: 'minLength.openapi.validation'
                },
                {
                    message: 'must be numeric',
                    path: 'body.age',
                    errorCode: 'pattern.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400); // 400 for validation errors (array)
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors.length, 2);
        assert.strictEqual(payload.errors[0].source.pointer, '/body/name');
        assert.strictEqual(payload.errors[1].source.pointer, '/body/age');
    });

    it('Should respond with 400 and error payload for malformed JSON', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = { type: 'entity.parse.failed' };

        errorHandler(err, req, res, next);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(Array.isArray(payload.errors));
        assert.ok(payload.errors.length > 0);
    });

    it('Should respond with 500 and error payload for unhandled server error', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = new Error('Something exploded');
        errorHandler(err, req, res, next);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(payload.errors[0].detail.includes('Something exploded'));
    });

    it('Should respond with 401 and error payload for known 4xx error', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'UnauthorizedError', message: 'Invalid token' };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(payload.errors[0].detail.includes('Invalid token'));
    });
    it('Should use OpenAPI custom error message if available', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'default message',
                    path: '/query/query',
                    errorCode: 'minLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'Search terms must be 2 characters or more');
    });

    it('Should fallback to default message if OpenAPI code not mapped', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                { message: 'default message', path: '/params/query', errorCode: 'unknownCode' }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'default message');
    });

    it('Should fallback to default status code if error name unknown', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'SomeRandomError', message: 'Unknown error' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 500);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'Unknown error');
    });
});
