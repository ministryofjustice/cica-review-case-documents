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
        log: { warn: () => {}, error: () => {} },
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
    const payload = { id: 1, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
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

    assert.equal(req.decodedToken.id, payload.id);
    assert.equal(req.decodedToken.name, payload.name);
    assert.ok(calledNext);
});

test('authenticateToken returns 401 if no token', async () => {
    const req = { headers: {}, log: { warn: () => {}, error: () => {} }, originalUrl: '/test' };
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

test('authenticateToken returns 500 when auth configuration is invalid', async () => {
    const token = jwt.sign({ id: 1 }, SECRET, {
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });

    delete process.env.APP_API_JWT_ISSUER;

    const req = createMockReq({ token });
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.ok(res.jsonBody);
    assert.equal(
        res.jsonBody.errors[0].detail,
        'Authentication service is not configured correctly'
    );
});

test('authenticateToken returns 403 when token has no usable identity claims', async () => {
    const token = jwt.sign({ email: 'test@example.com' }, SECRET, {
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

    assert.equal(res.statusCode, 403);
    assert.ok(res.jsonBody);
    assert.equal(
        res.jsonBody.errors[0].detail,
        'Authentication token is missing required identity claims'
    );
    assert.equal(calledNext, false);
});

test('authenticateToken uses fast-path when apiJwtVerified flag and decodedToken already set', async () => {
    const payload = { id: 1, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });

    // Pre-set the verification flag and token (as if middleware already ran once)
    const req = createMockReq({ token });
    req.apiJwtVerified = true;
    req.decodedToken = { id: 1, name: 'Test' };

    const res = createMockRes();
    let calledNext = false;

    await authenticateToken(req, res, () => {
        calledNext = true;
    });

    // Should skip verification and call next immediately
    assert.ok(calledNext);
    assert.strictEqual(res.statusCode, undefined); // No error response
});

test('authenticateToken sets apiJwtVerified flag after successful verification', async () => {
    const payload = { id: 1, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
        issuer: process.env.APP_API_JWT_ISSUER,
        audience: process.env.APP_API_JWT_AUDIENCE,
        algorithm: 'HS256'
    });
    const req = createMockReq({ token });
    const res = createMockRes();

    await authenticateToken(req, res, () => {});

    // After successful verification, flag should be set for future calls
    assert.strictEqual(req.apiJwtVerified, true);
    assert.ok(req.decodedToken);
    assert.equal(req.decodedToken.id, payload.id);
});
