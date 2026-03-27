import assert from 'node:assert';
import { afterEach, beforeEach, test } from 'node:test';

import { createLoginHandler } from './login-handler.js';

const originalEnv = { ...process.env };

function resetEnv() {
    process.env = { ...originalEnv };
}

function setRequiredEntraEnv() {
    process.env.ENTRA_CLIENT_ID = 'test-entra-client-id';
    process.env.ENTRA_CLIENT_SECRET = 'test-entra-client-secret';
    process.env.ENTRA_TENANT_ID = 'test-entra-tenant-id';
    process.env.APP_BASE_URL = 'https://example.test';
}

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

test('createLoginHandler returns 400 when Entra is not configured', () => {
    const handler = createLoginHandler();
    delete process.env.ENTRA_CLIENT_ID;

    const req = {
        query: {},
        session: {}
    };
    const { responsePayload, res } = createResponseRecorder();

    handler(req, res, () => {});

    assert.strictEqual(responsePayload.statusCode, 400);
    assert.strictEqual(responsePayload.body, 'Entra authentication is not configured');
});

test('createLoginHandler starts silent auth by default', () => {
    const handler = createLoginHandler();

    const req = {
        query: {},
        session: {}
    };
    const { responsePayload, res } = createResponseRecorder();

    handler(req, res, () => {});

    assert.strictEqual(typeof req.session.entraAuth.state, 'string');
    assert.strictEqual(typeof req.session.entraAuth.nonce, 'string');
    assert.strictEqual(req.session.entraAuth.mode, 'silent');
    assert.match(responsePayload.redirectLocation, /prompt=none/);
});

test('createLoginHandler supports interactive mode when requested', () => {
    const handler = createLoginHandler();

    const req = {
        query: { interactive: '1' },
        session: {}
    };
    const { responsePayload, res } = createResponseRecorder();

    handler(req, res, () => {});

    assert.strictEqual(req.session.entraAuth.mode, 'interactive');
    assert.doesNotMatch(responsePayload.redirectLocation, /prompt=none/);
});
