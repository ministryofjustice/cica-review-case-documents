/**
 * Creates a mock request object for testing JWT authentication middleware.
 * @param {Object} options - Options for the mock request.
 * @param {string} options.token - The JWT token to include.
 * @param {boolean} [options.cookie=false] - Whether to include the token in cookies or headers.
 * @returns {Object} Mock request object.
 */

/**
 * Creates a mock response object for testing JWT authentication middleware.
 * @returns {Object} Mock response object with status and send methods, and statusCode/sentMessage getters.
 */

/**
 * Test: authenticateToken attaches user for valid token in cookie.
 * Ensures that a valid JWT token in cookies attaches the user to the request and calls next().
 */

/**
 * Test: authenticateToken attaches user for valid token in header.
 * Ensures that a valid JWT token in the Authorization header attaches the user to the request and calls next().
 */

/**
 * Test: authenticateToken returns 401 if no token.
 * Ensures that if no JWT token is provided, the middleware responds with 401 and an appropriate message.
 */

/**
 * Test: authenticateToken returns 403 if token is invalid.
 * Ensures that if an invalid JWT token is provided, the middleware responds with 403 and an appropriate message.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import authenticateToken from './index.js';

const SECRET = process.env.APP_JWT_SECRET;

/**
 * Creates a mock Express request object with JWT token in either cookies or headers.
 *
 * @param {Object} options - Options for creating the mock request.
 * @param {string} options.token - The JWT token to include in the request.
 * @param {boolean} [options.cookie=false] - If true, places the token in cookies; otherwise, in the authorization header.
 * @returns {Object} Mock request object with cookies, headers, log, and originalUrl properties.
 */
function createMockReq({ token, cookie = false }) {
    return {
        cookies: cookie ? { jwtToken: token } : {},
        headers: cookie ? {} : { authorization: `Bearer ${token}` },
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
    let statusCode, sentMessage;
    return {
        status(code) {
            statusCode = code;
            return this;
        },
        send(msg) {
            sentMessage = msg;
            return this;
        },
        get statusCode() {
            return statusCode;
        },
        get sentMessage() {
            return sentMessage;
        }
    };
}

test('authenticateToken attaches user for valid token in cookie', async () => {
    const user = { id: 1, name: 'Test' };
    const token = jwt.sign(user, SECRET);
    const req = createMockReq({ token, cookie: true });
    const res = createMockRes();
    let calledNext = false;
    process.env.APP_JWT_SECRET = SECRET;

    await authenticateToken(req, res, () => {
        calledNext = true;
    });

    assert.equal(req.user.id, user.id);
    assert.equal(req.user.name, user.name);
    assert.ok(calledNext);
});

test('authenticateToken attaches user for valid token in header', async () => {
    const user = { id: 2, name: 'HeaderTest' };
    const token = jwt.sign(user, SECRET);
    const req = createMockReq({ token, cookie: false });
    const res = createMockRes();
    let calledNext = false;
    process.env.APP_JWT_SECRET = SECRET;

    await authenticateToken(req, res, () => {
        calledNext = true;
    });

    assert.equal(req.user.id, user.id);
    assert.equal(req.user.name, user.name);
    assert.ok(calledNext);
});

test('authenticateToken returns 401 if no token', async () => {
    const req = { cookies: {}, headers: {}, log: { warn: () => {} }, originalUrl: '/test' };
    const res = createMockRes();
    process.env.APP_JWT_SECRET = SECRET;

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.equal(res.sentMessage, 'Missing authentication token');
});

test('authenticateToken returns 403 if token is invalid', async () => {
    const req = createMockReq({ token: 'invalidtoken', cookie: true });
    const res = createMockRes();
    process.env.APP_JWT_SECRET = SECRET;

    await authenticateToken(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.sentMessage, 'Invalid authentication token');
});
