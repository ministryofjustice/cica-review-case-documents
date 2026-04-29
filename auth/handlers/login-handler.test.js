import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';

import { createLoginHandler } from './login-handler.js';

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

test('createLoginHandler returns 400 when Entra is not configured', async () => {
    const handler = createLoginHandler();
    delete process.env.ENTRA_CLIENT_ID;

    const req = {
        query: {},
        session: {}
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 400);
    assert.strictEqual(responsePayload.body, 'Entra authentication is not configured');
});

test('createLoginHandler starts silent auth by default', async () => {
    const handler = createLoginHandler();

    const req = {
        query: {},
        session: {
            regenerate: (callback) => {
                req.session = {
                    regenerate: req.session.regenerate
                };
                callback();
            }
        }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(typeof req.session.entraAuth.state, 'string');
    assert.strictEqual(typeof req.session.entraAuth.nonce, 'string');
    assert.strictEqual(req.session.entraAuth.mode, 'silent');
    assert.match(responsePayload.redirectLocation, /prompt=none/);
});

test('createLoginHandler starts interactive mode when one-time retry flag is present', async () => {
    const handler = createLoginHandler();

    const req = {
        query: {},
        session: {
            entraInteractiveRetry: {
                enabled: true
            },
            regenerate: (callback) => {
                req.session = {
                    regenerate: req.session.regenerate
                };
                callback();
            }
        }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(req.session.entraAuth.mode, 'interactive');
    assert.match(responsePayload.redirectLocation, /prompt=select_account/);
});

test('createLoginHandler ignores interactive query parameter without retry flag', async () => {
    const handler = createLoginHandler();

    const req = {
        query: { interactive: '1' },
        session: {
            regenerate: (callback) => {
                req.session = {
                    regenerate: req.session.regenerate
                };
                callback();
            }
        }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.strictEqual(req.session.entraAuth.mode, 'silent');
    assert.match(responsePayload.redirectLocation, /prompt=none/);
});

test('createLoginHandler forwards login_hint to authorize request', async () => {
    const handler = createLoginHandler();

    const req = {
        query: { login_hint: 'Known.User@Example.COM' },
        session: {
            regenerate: (callback) => {
                req.session = {
                    regenerate: req.session.regenerate
                };
                callback();
            }
        }
    };
    const { responsePayload, res } = createResponseRecorder();

    await handler(req, res, () => {});

    assert.match(responsePayload.redirectLocation, /login_hint=Known.User%40Example.COM/);
});
