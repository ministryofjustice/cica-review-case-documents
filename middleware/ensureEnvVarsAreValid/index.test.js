/**
 * Unit tests for ensureEnvVarsAreValid middleware and related functions.
 *
 * @fileoverview
 * - Tests that ensureEnvVarsAreValid calls next() when environment variables are valid.
 * - Tests getMandatoryEnvVars returns expected mandatory environment variable keys.
 * - Tests getOptionalEnvVars returns expected optional environment variable keys.
 * - Tests checkEnvVars throws ConfigurationError for invalid or missing mandatory/optional environment variables.
 *
 * @module ensureEnvVarsAreValid/index.test
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import ensureEnvVarsAreValid, { getMandatoryEnvVars, getOptionalEnvVars } from './index.js';

const fakeLogger = {
    info: () => {},
    child: () => fakeLogger
};

const originalEnv = { ...process.env };
/**
 * Restores the process environment variables to their original state.
 * Useful for resetting any changes made to process.env during tests.
 */
function resetEnv() {
    process.env = { ...originalEnv };
}

describe('ensureEnvVarsAreValid', () => {
    beforeEach(() => {
        resetEnv();
    });
    it('Should calls next() if everything is valid', async () => {
        let nextCalled = false;
        const req = { log: fakeLogger };
        const res = {};
        const next = () => {
            nextCalled = true;
        };

        ensureEnvVarsAreValid(req, res, next);
        assert.equal(nextCalled, true);
    });

    describe('getMandatoryEnvVars', () => {
        it('Should return the expected keys', () => {
            const vars = getMandatoryEnvVars();
            assert.deepEqual(vars, [
                'APP_COOKIE_NAME',
                'APP_COOKIE_SECRET',
                'APP_API_URL',
                'APP_DATABASE_URL',
                'OPENSEARCH_INDEX_CHUNKS_NAME',
                'APP_API_URL',
                'APP_S3_BUCKET_LOCATION'
            ]);
        });

        it('Should throw ConfigurationError if mandatoryEnvVars is not an array', async () => {
            const { checkEnvVars } = await import('./index.js');
            assert.throws(
                () => checkEnvVars({ mandatoryEnvVars: 'not an array', logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /must be a non-empty array/);
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError if mandatoryEnvVars is an empty array', async () => {
            const { checkEnvVars } = await import('./index.js');
            assert.throws(
                () => checkEnvVars({ mandatoryEnvVars: [], logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /must be a non-empty array/);
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError if required env var missing', async () => {
            const { checkEnvVars } = await import('./index.js');
            delete process.env.APP_COOKIE_NAME;
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /Environment variable "APP_COOKIE_NAME" must be set/);
                    return true;
                }
            );
        });
    });

    describe('getOptionalEnvVars', () => {
        it('Should return the expected keys', () => {
            const vars = getOptionalEnvVars();
            assert.deepEqual(vars, [
                'PORT',
                'APP_SEARCH_PAGINATION_ITEMS_PER_PAGE',
                'APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE',
                'APP_LOG_LEVEL',
                'APP_LOG_REDACT_EXTRA',
                'APP_LOG_REDACT_DISABLE'
            ]);
        });

        it('Should throw ConfigurationError if optionalEnvVars is not an array', async () => {
            const { checkEnvVars } = await import('./index.js');
            assert.throws(
                () => checkEnvVars({ optionalEnvVars: 'not an array', logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /must be a non-empty array/);
                    return true;
                }
            );
        });
    });
});
