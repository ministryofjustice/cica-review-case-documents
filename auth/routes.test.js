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
