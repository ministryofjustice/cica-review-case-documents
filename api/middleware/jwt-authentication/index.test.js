import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import authenticateToken from './index.js';

const SECRET = 'test-secret';

beforeEach(() => {
    process.env.APP_JWT_SECRET = SECRET;
    process.env.APP_API_JWT_ISSUER = 'test-ui';
    process.env.APP_API_JWT_AUDIENCE = 'test-api';
});

/**
 * Creates a mock Express request object with JWT token in authorization header.
 *
 * @param {Object} options - Options for creating the mock request.
 * @param {string} options.token - The JWT token to include in the request.
 * @returns {Object} Mock request object with cookies, headers, log, and originalUrl properties.
 */
function createMockReq({ token }) {
    return {
        headers: { authorization: `Bearer ${token}` },
        log: { warn: () => {} },
        originalUrl: '/test'
    };
}

/**
 * Creates a mock response object for testing Express middleware.
 * The mock object supports chaining of `status` and `send` methods,
 * and exposes `statusCode` and `sentMessage` getters for assertions.
 *
 * @returns {{
 *   status: (code: number) => object,
 *   send: (msg: any) => object,
 *   statusCode: number | undefined,
 *   sentMessage: any
 * }} Mock response object.
 */
function createMockRes() {
    let statusCode, sentMessage, jsonBody;
    return {
        status(code) {
            statusCode = code;
            return this;
        },
        send(msg) {
            sentMessage = msg;
            return this;
        },
        json(body) {
            jsonBody = body;
            return this;
        },
        get statusCode() {
            return statusCode;
        },
        get sentMessage() {
            return sentMessage;
        },
        get jsonBody() {
            return jsonBody;
        }
    };
}

test('authenticateToken attaches user for valid token in header', async () => {
    const user = { id: 1, name: 'Test' };
    const token = jwt.sign(user, SECRET, {
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });
    const req = createMockReq({ token });
    const res = createMockRes();
    let calledNext = false;

    await authenticateToken(req, res, () => {
        calledNext = true;
    });

    assert.equal(req.user.id, user.id);
    assert.equal(req.user.name, user.name);
    assert.ok(calledNext);
});

test('authenticateToken returns 401 if no token', async () => {
    const req = { headers: {}, log: { warn: () => {} }, originalUrl: '/test' };
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.ok(res.jsonBody);
    assert.equal(res.jsonBody.errors[0].detail, 'Missing authentication token');
});

test('authenticateToken returns 403 if token is invalid', async () => {
    const req = createMockReq({ token: 'invalidtoken' });
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.ok(res.jsonBody);
    assert.equal(res.jsonBody.errors[0].detail, 'Invalid authentication token');
});

test('authenticateToken returns 403 if token issuer is invalid', async () => {
    const token = jwt.sign({ id: 1 }, SECRET, {
        issuer: 'wrong-issuer',
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });
    const req = createMockReq({ token });
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.ok(res.jsonBody);
    assert.equal(res.jsonBody.errors[0].detail, 'Invalid authentication token');
});

test('authenticateToken returns 403 if token audience is invalid', async () => {
    const token = jwt.sign({ id: 1 }, SECRET, {
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: 'wrong-audience',
        algorithm: 'HS256'
    });
    const req = createMockReq({ token });
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.ok(res.jsonBody);
    assert.equal(res.jsonBody.errors[0].detail, 'Invalid authentication token');
});
