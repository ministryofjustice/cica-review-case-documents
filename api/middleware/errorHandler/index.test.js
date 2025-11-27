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
    it('Should log and respond correctly for a 400 malformed JSON error', () => {
        const { logger, logs } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = { type: 'entity.parse.failed' };

        errorHandler(err, req, res, next);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.json.mock.callCount(), 1);
        assert.ok(Array.isArray(res.json.mock.calls[0].arguments[0].errors));

        assert.strictEqual(logger.warn.mock.callCount(), 1);
        assert.strictEqual(logs[0].level, 'warn');
        assert.match(logs[0].msg, /UNHANDLED ERROR/);
    });

    it('Should log and respond correctly for unhandled server error', () => {
        const { logger, logs } = createMemoryLogger();

        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
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

        assert.strictEqual(logger.error.mock.callCount(), 1);
        assert.strictEqual(logs[0].level, 'error');
        assert.strictEqual(logs[0].obj.status, 500);
        assert.match(logs[0].msg, /UNHANDLED ERROR/);
    });

    it('Should log warn-level logging for known 4xx error', () => {
        const { logger, logs } = createMemoryLogger();

        const req = { log: logger };
        const res = {
            status(code) {
                this.statusCode = code;
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'UnauthorizedError', message: 'Invalid token' };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(logger.error.mock.callCount(), 1);
        assert.match(logs[0].msg, /UNHANDLED ERROR/);
        assert.strictEqual(logs[0].obj.status, 401);
    });
});
