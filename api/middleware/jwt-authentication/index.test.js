import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import createAuthenticateJWTToken from './index.js';

const SECRET = 'test-secret';
const ISSUER = 'test-ui';
const AUDIENCE = 'test-api';

const TEST_GUID = '123e4567-e89b-12d3-a456-426614174000'; // Example GUID for testing

// Config is injected directly into the middleware factory, so these tests do
// not read or mutate process.env and are safe to run without process isolation.
const authenticateToken = createAuthenticateJWTToken({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE
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

test('authenticateToken succeeds and attaches payload parameters for valid token in header', async () => {
    const payload = { id: TEST_GUID, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
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

test('authenticateToken succeeds when token has whitespace suffix', async () => {
    const id_with_whitespace = `${TEST_GUID} `;
    const payload = { id: id_with_whitespace };
    const token = jwt.sign(payload, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithm: 'HS256'
    });
    const req = createMockReq({ token });
    const res = createMockRes();
    let calledNext = false;

    await authenticateToken(req, res, () => {
        calledNext = true;
    });

    assert.equal(req.decodedToken.id, id_with_whitespace.trim());
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
    const token = jwt.sign({ id: TEST_GUID }, SECRET, {
        issuer: 'wrong-issuer',
        audience: AUDIENCE,
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
    const token = jwt.sign({ id: TEST_GUID }, SECRET, {
        issuer: ISSUER,
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
    // Build a middleware instance with incomplete config (missing issuer). The
    // configuration error is captured at creation time and surfaced as a 500 on
    // each request, without reading global state.
    const misconfiguredAuth = createAuthenticateJWTToken({
        secret: SECRET,
        issuer: undefined,
        audience: AUDIENCE
    });

    const token = jwt.sign({ id: TEST_GUID }, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithm: 'HS256'
    });

    const req = createMockReq({ token });
    const res = createMockRes();

    await misconfiguredAuth(req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.ok(res.jsonBody);
    assert.equal(
        res.jsonBody.errors[0].detail,
        'Authentication service is not configured correctly'
    );
});

test('authenticateToken returns 403 when token has no usable identity claims', async () => {
    const token = jwt.sign({ email: 'test@example.com' }, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
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

test('authenticateToken returns 403 when token has whitespace only identity claims', async () => {
    const token = jwt.sign({ id: '   ' }, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
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
    const payload = { id: TEST_GUID, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
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
    const payload = { id: TEST_GUID, name: 'Test' };
    const token = jwt.sign(payload, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
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
