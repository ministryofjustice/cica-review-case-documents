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
    child: () => fakeLogger,
    debug: () => {},
    warn: () => {}
};

const originalEnv = { ...process.env };
/**
 * Restores the process environment variables to their original state.
 * Useful for resetting any changes made to process.env during tests.
 */
function resetEnv() {
    process.env = { ...originalEnv };
}

/**
 * Sets mandatory Entra environment variables used during env validation tests.
 */
function setRequiredEntraEnv() {
    process.env.ENTRA_CLIENT_ID = 'client-id';
    process.env.ENTRA_CLIENT_SECRET_ID = 'client-secret';
    process.env.ENTRA_TENANT_ID = 'tenant-id';
}

describe('ensureEnvVarsAreValid', () => {
    beforeEach(() => {
        resetEnv();
        setRequiredEntraEnv();
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
                'APP_BASE_URL',
                'APP_JWT_SECRET',
                'APP_API_JWT_ISSUER',
                'APP_API_JWT_AUDIENCE',
                'APP_DATABASE_URL',
                'OPENSEARCH_INDEX_CHUNKS_NAME',
                'ENTRA_CLIENT_ID',
                'ENTRA_CLIENT_SECRET_ID',
                'ENTRA_TENANT_ID'
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
                    assert.match(
                        err.message,
                        /Environment variable "APP_COOKIE_NAME" must be set and non-empty/
                    );
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError if required env var is an empty string', async () => {
            const { checkEnvVars } = await import('./index.js');
            process.env.APP_COOKIE_NAME = '';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(
                        err.message,
                        /Environment variable "APP_COOKIE_NAME" must be set and non-empty/
                    );
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError if required env var is whitespace only', async () => {
            const { checkEnvVars } = await import('./index.js');
            process.env.APP_COOKIE_NAME = '   ';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(
                        err.message,
                        /Environment variable "APP_COOKIE_NAME" must be set and non-empty/
                    );
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError if ENTRA_CLIENT_ID is an empty string', async () => {
            const { checkEnvVars } = await import('./index.js');
            process.env.ENTRA_CLIENT_ID = '';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(
                        err.message,
                        /Environment variable "ENTRA_CLIENT_ID" must be set and non-empty/
                    );
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
                'APP_ALLOW_INSECURE_COOKIE',
                'APP_API_JWT_EXPIRES_IN',
                'APP_ENTRA_RATE_LIMIT_WINDOW_MS',
                'APP_ENTRA_RATE_LIMIT_MAX_LOGIN',
                'APP_ENTRA_RATE_LIMIT_MAX_CALLBACK',
                'ENTRA_SCOPE',
                'ENTRA_INTERACTIVE_FALLBACK',
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

        it('Should log debug message when optional env var is not set', async () => {
            const { checkEnvVars } = await import('./index.js');
            let debugCalled = false;
            let debugPayload = null;
            const mockLogger = {
                info: () => {},
                child: () => mockLogger,
                warn: () => {},
                debug: (payload, message) => {
                    debugCalled = true;
                    debugPayload = payload;
                }
            };

            delete process.env.PORT;
            checkEnvVars({ optionalEnvVars: ['PORT'], logger: mockLogger });

            assert.equal(debugCalled, true);
            assert.equal(debugPayload.data.environmentVariableName, 'PORT');
        });

        it('Should not log when optional env var is set', async () => {
            const { checkEnvVars } = await import('./index.js');
            let debugCalled = false;
            const mockLogger = {
                info: () => {},
                child: () => mockLogger,
                warn: () => {},
                debug: () => {
                    debugCalled = true;
                }
            };

            process.env.PORT = '3000';
            checkEnvVars({ optionalEnvVars: ['PORT'], logger: mockLogger });

            assert.equal(debugCalled, false);
        });

        it('Should throw ConfigurationError if logger is invalid', async () => {
            const { checkEnvVars } = await import('./index.js');
            assert.throws(
                () => checkEnvVars({ logger: { notALogger: true } }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /Invalid logger instance/);
                    return true;
                }
            );
        });

        it('Should accept APP_API_JWT_EXPIRES_IN in seconds and minutes up to 5 minutes', async () => {
            const { checkEnvVars } = await import('./index.js');

            process.env.APP_API_JWT_EXPIRES_IN = '60s';
            assert.doesNotThrow(() => checkEnvVars({ logger: fakeLogger }));

            process.env.APP_API_JWT_EXPIRES_IN = '5m';
            assert.doesNotThrow(() => checkEnvVars({ logger: fakeLogger }));
        });

        it('Should throw ConfigurationError when APP_API_JWT_EXPIRES_IN format is invalid', async () => {
            const { checkEnvVars } = await import('./index.js');

            process.env.APP_API_JWT_EXPIRES_IN = '1h';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /APP_API_JWT_EXPIRES_IN/);
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError when APP_API_JWT_EXPIRES_IN exceeds 5 minutes', async () => {
            const { checkEnvVars } = await import('./index.js');

            process.env.APP_API_JWT_EXPIRES_IN = '301s';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /<= 300s/);
                    return true;
                }
            );
        });

        it('Should throw ConfigurationError when APP_ALLOW_INSECURE_COOKIE is not true/false', async () => {
            const { checkEnvVars } = await import('./index.js');

            process.env.APP_ALLOW_INSECURE_COOKIE = 'yes';
            assert.throws(
                () => checkEnvVars({ logger: fakeLogger }),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /APP_ALLOW_INSECURE_COOKIE/);
                    return true;
                }
            );
        });

        it('Should warn when APP_ALLOW_INSECURE_COOKIE is true in production mode', async () => {
            const { checkEnvVars } = await import('./index.js');

            let warnCalled = false;
            const mockLogger = {
                info: () => {},
                child: () => mockLogger,
                debug: () => {},
                warn: () => {
                    warnCalled = true;
                }
            };

            process.env.NODE_ENV = 'production';
            process.env.APP_ALLOW_INSECURE_COOKIE = 'true';

            checkEnvVars({ logger: mockLogger });

            assert.equal(warnCalled, true);
        });
    });
});
