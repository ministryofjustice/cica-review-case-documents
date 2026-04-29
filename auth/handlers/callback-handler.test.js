import assert from 'node:assert';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import got from 'got';
import jwt from 'jsonwebtoken';

import { createCallbackHandler } from './callback-handler.js';

const originalEnv = { ...process.env };

/**
 * Restores process environment variables to the initial test snapshot.
 */
function resetEnv() {
    process.env = { ...originalEnv };
}

/**
 * Sets the minimum Entra variables required for handler tests.
 */
function setRequiredEntraEnv() {
    process.env.ENTRA_CLIENT_ID = 'test-entra-client-id';
    process.env.ENTRA_CLIENT_SECRET = 'test-entra-client-secret';
    process.env.ENTRA_TENANT_ID = 'test-entra-tenant-id';
    process.env.APP_BASE_URL = 'https://example.test';
}

/**
 * Creates a lightweight response stub that records status, body, and redirect.
 *
 * @returns {{ responsePayload: Record<string, unknown>, res: { status: (statusCode: number) => { send: (body: unknown) => unknown }, redirect: (location: string) => string } }}
 */
function createResponseRecorder() {
    const responsePayload = {};

    return {
        responsePayload,
        res: {
            status: (statusCode) => {
                responsePayload.statusCode = statusCode;
                return {
                    send: (body) => {
                        responsePayload.body = body;
                        return body;
                    }
                };
            },
            redirect: (location) => {
                responsePayload.redirectLocation = location;
                return location;
            }
        }
    };
}

beforeEach(() => {
    resetEnv();
    setRequiredEntraEnv();
});

afterEach(() => {
    resetEnv();
});

test('createCallbackHandler returns 400 when Entra is not configured', async () => {
    const handler = createCallbackHandler();
    delete process.env.ENTRA_CLIENT_ID;

    const req = {
        query: {},
        session: {},
        log: { warn: () => {}, info: () => {}, error: () => {} }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 400);
    assert.strictEqual(responsePayload.body, 'Entra authentication is not configured');
});

test('createCallbackHandler does not retry interactive login for login_required without targeted error code', async () => {
    const handler = createCallbackHandler();

    const req = {
        query: {
            error: 'login_required',
            error_description: 'AADSTS50058: User session missing'
        },
        session: {
            entraAuth: {
                mode: 'silent'
            }
        },
        log: { warn: () => {}, info: () => {}, error: () => {} }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Authentication failed');
    assert.strictEqual(req.session.entraInteractiveRetry, undefined);
});

test('createCallbackHandler retries interactive login for AADSTS16000 callback errors', async () => {
    const handler = createCallbackHandler();

    const req = {
        query: {
            error: 'interaction_required',
            error_description:
                'AADSTS16000: Either multiple user identities are available or selected account is unsupported'
        },
        session: {
            entraAuth: {
                mode: 'silent'
            }
        },
        log: { warn: () => {}, info: () => {}, error: () => {} }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(responsePayload.redirectLocation, '/auth/login');
    assert.deepStrictEqual(req.session.entraInteractiveRetry, {
        enabled: true
    });
});

test('createCallbackHandler rejects invalid auth transaction when session is missing', async () => {
    const handler = createCallbackHandler();

    const req = {
        query: {
            code: 'auth-code',
            state: 'state-1'
        },
        log: { warn: () => {}, info: () => {}, error: () => {} }
    };
    const { responsePayload, res } = createResponseRecorder();

    let nextError;
    await handler(req, res, (err) => {
        nextError = err;
    });

    assert.strictEqual(nextError, undefined);
    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Invalid authentication state');
});

test('createCallbackHandler regenerates session and redirects to returnTo on successful sign-in', async () => {
    const handler = createCallbackHandler();
    const originalGet = got.get;
    const originalPost = got.post;

    try {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const kid = 'auth-service-kid-1';
        const issuer = 'https://login.microsoftonline.com/test-entra-tenant-id/v2.0';
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', kty: 'RSA' };

        const nonce = 'nonce-auth-service-1';
        const idToken = jwt.sign(
            {
                sub: 'entra-user-service-1',
                nonce,
                tid: 'tenant-1',
                oid: 'oid-service-1',
                name: 'Service User',
                preferred_username: 'service.user@example.com'
            },
            privateKey,
            {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'test-entra-client-id',
                expiresIn: '5m'
            }
        );

        got.get = () => ({
            json: async () => ({ keys: [jwk] })
        });
        got.post = () => ({
            json: async () => ({ id_token: idToken })
        });

        const req = {
            query: {
                code: 'auth-code',
                state: 'state-service-1'
            },
            protocol: 'https',
            get: () => 'example.test',
            session: {
                entraAuth: {
                    state: 'state-service-1',
                    nonce,
                    createdAt: Date.now()
                },
                returnTo: '/search?query=abc',
                caseSelected: true,
                caseReferenceNumber: '12-123456',
                regenerate: (callback) => {
                    req.session = {
                        regenerate: req.session.regenerate
                    };
                    callback();
                }
            },
            log: { warn: () => {}, info: () => {}, error: () => {} }
        };

        const { responsePayload, res } = createResponseRecorder();
        let nextError;
        await handler(req, res, (err) => {
            nextError = err;
        });

        assert.strictEqual(nextError, undefined);
        assert.strictEqual(responsePayload.redirectLocation, '/search?query=abc');
        assert.strictEqual(req.session.loggedIn, true);
        assert.strictEqual(req.session.username, 'service.user@example.com');
        assert.deepStrictEqual(req.session.entraUser, {
            oid: 'oid-service-1',
            tid: 'tenant-1',
            name: 'Service User'
        });
        assert.strictEqual(req.session.returnTo, undefined);
        assert.strictEqual(req.session.caseSelected, true);
        assert.strictEqual(req.session.caseReferenceNumber, '12-123456');
    } finally {
        got.get = originalGet;
        got.post = originalPost;
    }
});

test('createCallbackHandler defaults redirect to root when returnTo is missing', async () => {
    const handler = createCallbackHandler();
    const originalGet = got.get;
    const originalPost = got.post;

    try {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const kid = 'auth-service-kid-2';
        const issuer = 'https://login.microsoftonline.com/test-entra-tenant-id/v2.0';
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', kty: 'RSA' };

        const nonce = 'nonce-auth-service-2';
        const idToken = jwt.sign(
            {
                sub: 'entra-user-service-2',
                nonce,
                tid: 'tenant-1',
                oid: 'oid-service-2',
                name: 'Root Redirect User',
                preferred_username: 'root.redirect@example.com'
            },
            privateKey,
            {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'test-entra-client-id',
                expiresIn: '5m'
            }
        );

        got.get = () => ({
            json: async () => ({ keys: [jwk] })
        });
        got.post = () => ({
            json: async () => ({ id_token: idToken })
        });

        const req = {
            query: {
                code: 'auth-code',
                state: 'state-service-2'
            },
            protocol: 'https',
            get: () => 'example.test',
            session: {
                entraAuth: {
                    state: 'state-service-2',
                    nonce,
                    createdAt: Date.now()
                },
                regenerate: (callback) => {
                    req.session = {
                        regenerate: req.session.regenerate
                    };
                    callback();
                }
            },
            log: { warn: () => {}, info: () => {}, error: () => {} }
        };

        const { responsePayload, res } = createResponseRecorder();
        let nextError;
        await handler(req, res, (err) => {
            nextError = err;
        });

        assert.strictEqual(nextError, undefined);
        assert.strictEqual(responsePayload.redirectLocation, '/');
    } finally {
        got.get = originalGet;
        got.post = originalPost;
    }
});
