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
});
