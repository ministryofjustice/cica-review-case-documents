import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import pinoHttp from 'pino-http';
import isLogger from './index.js';

describe('isLogger', () => {
    it('returns true for a pino instance', () => {
        const logger = pino();
        assert.ok(isLogger(logger));
    });

    it('returns true for a pino-http middleware', () => {
        const httpLogger = pinoHttp();
        assert.ok(isLogger(httpLogger));
    });

    it('returns false for non-loggers', () => {
        const badValues = [null, undefined, {}, () => {}, { info: () => {} }];
        for (const val of badValues) {
            assert.strictEqual(isLogger(val), false);
        }
    });

    it('returns true for a pino-like mock (used in tests)', () => {
        const mock = {
            info: () => {},
            child: () => mock
        };
        assert.ok(isLogger(mock));
    });
});
