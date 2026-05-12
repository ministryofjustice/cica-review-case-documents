import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import safeErrorForLog from './index.js';

describe('safeErrorForLog', () => {
    it('uses statusCode from top-level error when present', () => {
        const result = safeErrorForLog({ statusCode: 404 });
        assert.strictEqual(result.statusCode, 404);
    });

    it('falls back to response.statusCode when top-level statusCode is missing', () => {
        const result = safeErrorForLog({ response: { statusCode: 503 } });
        assert.strictEqual(result.statusCode, 503);
    });

    it('prefers top-level statusCode over response.statusCode when both exist', () => {
        const result = safeErrorForLog({
            statusCode: 401,
            response: { statusCode: 500 }
        });
        assert.strictEqual(result.statusCode, 401);
    });

    it('preserves cause error details for error chain tracking', () => {
        const causeErr = new Error('Original error');
        causeErr.name = 'HTTPError';
        causeErr.code = 'ERR_NETWORK';
        causeErr.stack = 'HTTPError: Network failed\n    at ...';

        const err = new Error('Wrapped error');
        err.cause = causeErr;

        const result = safeErrorForLog(err);
        assert.deepStrictEqual(result.cause, {
            name: 'HTTPError',
            message: 'Original error',
            code: 'ERR_NETWORK',
            stack: 'HTTPError: Network failed\n    at ...'
        });
    });
});
