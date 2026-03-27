import assert from 'node:assert';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import got from 'got';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createApp from '../app.js';
import authRouter, { createLoginHandler } from './routes.js';

const originalEnv = { ...process.env };

let app;
let agent;

/**
 * Retrieves the route handler for a given path from the authRouter.
 *
 * @param {string} path - The path of the route.
 * @returns {Function|undefined} The route handler function or undefined if not found.
 */
function getRouteHandler(path) {
    const layer = authRouter.stack.find((entry) => entry.route?.path === path);
    return layer?.route?.stack?.at(-1)?.handle;
}

afterEach(() => {
    process.env = { ...originalEnv };
});

beforeEach(async () => {
    app = await createApp({
        createLogger: () => (req, res, next) => {
            req.log = {
                error: () => {},
                info: () => {},
                warn: () => {},
                debug: () => {},
                child: () => req.log
            };
            next();
        }
    });
    agent = request.agent(app);
});

test('GET /auth/login with Entra configured should request silent sign-in', async () => {
    const response = await agent.get('/auth/login');

    assert.strictEqual(response.status, 302);
    assert.match(
        response.headers.location,
        /^https:\/\/login\.microsoftonline\.com\/test-entra-tenant-id\/oauth2\/v2\.0\/authorize\?/
    );
    assert.match(response.headers.location, /prompt=none/);
});

test('createLoginHandler should return 400 when Entra is not configured', () => {
    const loginHandler = createLoginHandler();
    const req = {
        query: {},
        session: {}
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    delete process.env.ENTRA_CLIENT_ID;

    loginHandler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 400);
    assert.strictEqual(responsePayload.body, 'Entra authentication is not configured');
});

test('createLoginHandler should pass unexpected errors to next', () => {
    const loginHandler = createLoginHandler();
    const req = {
        query: {},
        session: {}
    };

    const expectedError = new Error('redirect-failed');
    const res = {
        redirect: () => {
            throw expectedError;
        }
    };

    let nextError;
    loginHandler(req, res, (err) => {
        nextError = err;
    });

    assert.strictEqual(nextError, expectedError);
});

test('GET /auth/callback with login_required should fallback to interactive by default', async () => {
    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'login_required',
        error_description: 'Silent sign-in required interaction'
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/auth/login?interactive=1');
});

test('GET /auth/callback with login_required should fail when interactive fallback is disabled', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'false';

    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'login_required',
        error_description: 'Silent sign-in required interaction'
    });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Authentication failed/);
});

test('GET /auth/callback should handle non-interactive Entra error with AADSTS code', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'false';

    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'server_error',
        error_description: 'AADSTS50058: User session missing',
        error_uri: 'https://login.microsoftonline.com/error?code=50058'
    });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Authentication failed/);
});

test('GET /auth/callback should handle Entra error when error_description is missing', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'false';

    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'server_error'
    });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Authentication failed/);
});

test('callback handler should return 400 when Entra is not configured', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {},
        session: {},
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    delete process.env.ENTRA_CLIENT_ID;

    await callbackHandler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 400);
    assert.strictEqual(responsePayload.body, 'Entra authentication is not configured');
});

test('callback handler should reject stale auth transaction and clear pending state', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {
            code: 'auth-code',
            state: 'state-1'
        },
        session: {
            entraAuth: {
                state: 'state-1',
                nonce: 'nonce-1',
                createdAt: Date.now() - 11 * 60 * 1000
            }
        },
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    await callbackHandler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Invalid authentication state');
    assert.strictEqual(req.session.entraAuth, undefined);
});

test('callback handler should reject callback when code is an array query parameter', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {
            code: ['auth-code-a', 'auth-code-b'],
            state: 'state-1'
        },
        session: {
            entraAuth: {
                state: 'state-1',
                nonce: 'nonce-1',
                createdAt: Date.now()
            }
        },
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    await callbackHandler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Invalid authentication state');
    assert.strictEqual(req.session.entraAuth, undefined);
});

test('callback handler should reject callback when state is an array query parameter', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {
            code: 'auth-code',
            state: ['state-1', 'state-2']
        },
        session: {
            entraAuth: {
                state: 'state-1',
                nonce: 'nonce-1',
                createdAt: Date.now()
            }
        },
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    await callbackHandler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Invalid authentication state');
    assert.strictEqual(req.session.entraAuth, undefined);
});

test('callback handler should return 401 for Entra errors when session is missing', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {
            error: 'server_error',
            error_description: 'AADSTS50058: User session missing'
        },
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    let nextError;
    await callbackHandler(req, res, (err) => {
        nextError = err;
    });

    assert.strictEqual(nextError, undefined);
    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Authentication failed');
});

test('callback handler should return 401 for invalid auth transaction when session is missing', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const req = {
        query: {
            code: 'auth-code',
            state: 'state-1'
        },
        log: {
            warn: () => {},
            info: () => {},
            error: () => {}
        }
    };

    const responsePayload = {};
    const res = {
        status: (statusCode) => {
            responsePayload.statusCode = statusCode;
            return {
                send: (body) => {
                    responsePayload.body = body;
                    return body;
                }
            };
        }
    };

    let nextError;
    await callbackHandler(req, res, (err) => {
        nextError = err;
    });

    assert.strictEqual(nextError, undefined);
    assert.strictEqual(responsePayload.statusCode, 401);
    assert.strictEqual(responsePayload.body, 'Invalid authentication state');
});

test('callback handler should regenerate session and preserve required values after sign-in', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const originalGet = got.get;
    const originalPost = got.post;

    try {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const kid = 'test-kid-session-regeneration';
        const issuer = 'https://login.microsoftonline.com/test-entra-tenant-id/v2.0';
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', kty: 'RSA' };

        const nonce = 'nonce-session-regen';
        const idToken = jwt.sign(
            {
                sub: 'entra-user-regen',
                nonce,
                tid: 'tenant-1',
                oid: 'oid-session-regen',
                name: 'Session Regen User',
                preferred_username: 'session.regen@example.com'
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

        let regenerateCalls = 0;
        const req = {
            query: {
                code: 'auth-code',
                state: 'state-session-regen'
            },
            protocol: 'https',
            get: () => 'example.test',
            session: {
                entraAuth: {
                    state: 'state-session-regen',
                    nonce,
                    createdAt: Date.now()
                },
                returnTo: '/search?query=abc',
                caseSelected: true,
                caseReferenceNumber: '12-123456',
                regenerate: (callback) => {
                    regenerateCalls += 1;
                    req.session = {
                        regenerate: req.session.regenerate
                    };
                    callback();
                }
            },
            log: {
                warn: () => {},
                info: () => {},
                error: () => {}
            }
        };

        let redirectedTo;
        const res = {
            redirect: (location) => {
                redirectedTo = location;
                return location;
            }
        };

        let nextError;
        await callbackHandler(req, res, (err) => {
            nextError = err;
        });

        assert.strictEqual(nextError, undefined);
        assert.strictEqual(regenerateCalls, 1);
        assert.strictEqual(redirectedTo, '/search?query=abc');
        assert.strictEqual(req.session.loggedIn, true);
        assert.strictEqual(req.session.username, 'session.regen@example.com');
        assert.deepStrictEqual(req.session.entraUser, {
            oid: 'oid-session-regen',
            tid: 'tenant-1',
            name: 'Session Regen User'
        });
        assert.strictEqual(req.session.returnTo, undefined);
        assert.strictEqual(req.session.caseSelected, true);
        assert.strictEqual(req.session.caseReferenceNumber, '12-123456');
    } finally {
        got.get = originalGet;
        got.post = originalPost;
    }
});

test('GET /auth/callback should complete sign-in when state and token are valid', async () => {
    const originalGet = got.get;
    const originalPost = got.post;

    try {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const kid = 'test-kid';
        const issuer = 'https://login.microsoftonline.com/test-entra-tenant-id/v2.0';
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

        let idToken = '';
        got.get = () => ({
            json: async () => ({ keys: [jwk] })
        });
        got.post = () => ({
            json: async () => ({ id_token: idToken })
        });

        const loginResponse = await agent.get('/auth/login').expect(302);
        const authorizeUrl = new URL(loginResponse.headers.location);
        const state = authorizeUrl.searchParams.get('state');
        const nonce = authorizeUrl.searchParams.get('nonce');

        idToken = jwt.sign(
            {
                sub: 'entra-user-1',
                nonce,
                tid: 'tenant-1',
                oid: 'oid-1',
                name: 'Test User',
                preferred_username: 'test.user@example.com'
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

        const response = await agent.get('/auth/callback').query({ code: 'auth-code', state });

        assert.strictEqual(response.status, 302);
        assert.strictEqual(response.headers.location, '/');
    } finally {
        got.get = originalGet;
        got.post = originalPost;
    }
});

test('GET /auth/callback should authenticate when oid is missing and fallback to sub', async () => {
    const originalGet = got.get;
    const originalPost = got.post;

    try {
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const kid = 'test-kid-sub-fallback';
        const issuer = 'https://login.microsoftonline.com/test-entra-tenant-id/v2.0';
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

        let idToken = '';
        got.get = () => ({
            json: async () => ({ keys: [jwk] })
        });
        got.post = () => ({
            json: async () => ({ id_token: idToken })
        });

        const loginResponse = await agent.get('/auth/login').expect(302);
        const authorizeUrl = new URL(loginResponse.headers.location);
        const state = authorizeUrl.searchParams.get('state');
        const nonce = authorizeUrl.searchParams.get('nonce');

        idToken = jwt.sign(
            {
                sub: 'entra-sub-only',
                nonce,
                tid: 'tenant-1',
                name: 'Sub Only User',
                preferred_username: 'sub.user@example.com'
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

        const response = await agent.get('/auth/callback').query({ code: 'auth-code', state });

        assert.strictEqual(response.status, 302);
        assert.strictEqual(response.headers.location, '/');
    } finally {
        got.get = originalGet;
        got.post = originalPost;
    }
});

test('GET /auth/callback should pass token exchange errors to error handler', async () => {
    const originalPost = got.post;

    try {
        got.post = () => {
            throw new Error('entra-token-exchange-failed');
        };

        const loginResponse = await agent.get('/auth/login').expect(302);
        const authorizeUrl = new URL(loginResponse.headers.location);
        const state = authorizeUrl.searchParams.get('state');

        const response = await agent.get('/auth/callback').query({ code: 'auth-code', state });

        assert.strictEqual(response.status, 500);
    } finally {
        got.post = originalPost;
    }
});

test('callback handler should log a sanitized error when token exchange fails', async () => {
    const callbackHandler = getRouteHandler('/callback');
    const originalPost = got.post;
    const tokenExchangeError = Object.assign(new Error('entra-token-exchange-failed'), {
        name: 'HTTPError',
        code: 'ERR_NON_2XX_3XX_RESPONSE',
        options: {
            json: {
                client_secret: 'super-secret',
                code: 'auth-code'
            }
        },
        response: {
            statusCode: 401,
            body: 'sensitive-response'
        }
    });

    const loggedErrors = [];
    const req = {
        query: {
            code: 'auth-code',
            state: 'state-1'
        },
        session: {
            entraAuth: {
                state: 'state-1',
                nonce: 'nonce-1',
                createdAt: Date.now()
            }
        },
        log: {
            warn: () => {},
            info: () => {},
            error: (payload, message) => {
                loggedErrors.push({ payload, message });
            }
        }
    };

    try {
        got.post = () => {
            throw tokenExchangeError;
        };

        let capturedError;
        await callbackHandler(req, {}, (err) => {
            capturedError = err;
        });

        assert.strictEqual(capturedError, tokenExchangeError);
        assert.strictEqual(loggedErrors.length, 1);
        assert.deepStrictEqual(loggedErrors[0].payload.name, 'HTTPError');
        assert.deepStrictEqual(loggedErrors[0].payload.message, 'entra-token-exchange-failed');
        assert.deepStrictEqual(loggedErrors[0].payload.code, 'ERR_NON_2XX_3XX_RESPONSE');
        assert.deepStrictEqual(loggedErrors[0].payload.statusCode, 401);
        assert.strictEqual(loggedErrors[0].message, 'Entra callback handling failed');
        assert.equal(typeof loggedErrors[0].payload.stack, 'string');
        assert.equal('options' in loggedErrors[0].payload, false);
        assert.equal('response' in loggedErrors[0].payload, false);
    } finally {
        got.post = originalPost;
    }
});

test('GET /auth/login?interactive=1 should skip prompt=none when fallback is enabled', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'true';

    const response = await agent.get('/auth/login').query({ interactive: '1' });

    assert.strictEqual(response.status, 302);
    assert.doesNotMatch(response.headers.location, /prompt=none/);
});

test('GET /auth/sign-out displays sign out message without active session', async () => {
    const response = await agent.get('/auth/sign-out');

    assert.strictEqual(response.status, 200);
    assert.match(response.text, /You have signed out/);
});

test('sign-out route should call next when signOutUser throws', () => {
    const signOutHandler = getRouteHandler('/sign-out');
    const req = {};

    let capturedError;
    signOutHandler(req, {}, (err) => {
        capturedError = err;
    });

    assert.ok(capturedError instanceof Error);
});

test('sign-out route should call next when session.destroy fails', () => {
    const signOutHandler = getRouteHandler('/sign-out');
    const destroyError = Object.assign(new Error('Store connection failed'), {
        name: 'StoreError',
        code: 'STORE_DOWN',
        response: {
            statusCode: 503,
            body: 'sensitive-store-response'
        },
        options: {
            json: {
                token: 'sensitive-token'
            }
        }
    });
    const loggedErrors = [];
    const req = {
        session: {
            caseReferenceNumber: 'ABC123',
            destroy: (callback) => {
                callback(destroyError);
            }
        },
        log: {
            error: (payload, message) => {
                loggedErrors.push({ payload, message });
            }
        }
    };

    let capturedError;
    signOutHandler(req, {}, (err) => {
        capturedError = err;
    });

    assert.strictEqual(capturedError, destroyError);
    assert.strictEqual(loggedErrors.length, 1);
    assert.deepStrictEqual(loggedErrors[0].payload.name, 'StoreError');
    assert.deepStrictEqual(loggedErrors[0].payload.message, 'Store connection failed');
    assert.deepStrictEqual(loggedErrors[0].payload.code, 'STORE_DOWN');
    assert.deepStrictEqual(loggedErrors[0].payload.statusCode, 503);
    assert.strictEqual(loggedErrors[0].message, 'Session destruction failed');
    assert.equal(typeof loggedErrors[0].payload.stack, 'string');
    assert.equal('options' in loggedErrors[0].payload, false);
    assert.equal('response' in loggedErrors[0].payload, false);
});
