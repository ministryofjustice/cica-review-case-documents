/**
 * Unit tests for the isAuthenticated middleware.
 *
 * These tests cover the following scenarios:
 * - Middleware calls `next` if `session.loggedIn` is true.
 * - Middleware redirects to `/auth/login` if no token is present.
 * - Middleware calls `next` and sets `req.user` if a valid JWT token is present in cookies.
 * - Middleware calls `next` and sets `req.user` if a valid JWT token is present in the Authorization header.
 * - Middleware redirects to `/auth/login` if the JWT token is invalid.
 *
 * Helper functions:
 * - `createMockReq`: Creates a mock request object with customizable session, cookies, headers, log, and originalUrl.
 * - `createMockRes`: Creates a mock response object with a redirect method and a property to check the redirected URL.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import isAuthenticated from './index.js';

/**
 * Creates a mock request object for testing purposes.
 *
 * @param {Object} [options={}] - Options to customize the mock request.
 * @param {Object} [options.session={}] - Mock session object.
 * @param {Object} [options.cookies={}] - Mock cookies object.
 * @param {Object} [options.headers={}] - Mock headers object.
 * @param {Object} [options.log={ warn: function() {} }] - Mock logger with a warn method.
 * @param {string} [options.originalUrl='/test'] - Mock original URL.
 * @returns {Object} Mock request object with session, cookies, headers, log, and originalUrl properties.
 */
function createMockReq({
    session = {},
    cookies = {},
    headers = {},
    log = { warn: () => {} },
    originalUrl = '/test'
} = {}) {
    return { session, cookies, headers, log, originalUrl };
}

/**
 * Creates a mock response object for testing purposes.
 * The mock object provides a `redirect` method to simulate redirection,
 * and a `redirectedUrl` getter to retrieve the last redirected URL.
 *
 * @returns {{redirect: function(string): void, redirectedUrl: string|null}}
 *   An object with a `redirect` method and a `redirectedUrl` property.
 */
function createMockRes() {
    let redirectedUrl = null;
    return {
        redirect: (url) => {
            redirectedUrl = url;
        },
        get redirectedUrl() {
            return redirectedUrl;
        }
    };
}

test('should call next if session.loggedIn is true', (t) => {
    let nextCalled = false;
    const req = createMockReq({ session: { loggedIn: true } });
    const res = createMockRes();
    isAuthenticated(req, res, () => {
        nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
});

test('should redirect to /auth/login if no token is present', (t) => {
    const req = createMockReq();
    const res = createMockRes();
    isAuthenticated(req, res, () => {});
    assert.strictEqual(res.redirectedUrl, '/auth/login');
    assert.strictEqual(req.session.returnTo, req.originalUrl);
});

test('should call next if valid JWT token in cookie', (t) => {
    let nextCalled = false;
    const token = jwt.sign({ username: 'user' }, 'testsecret');
    const req = createMockReq({ cookies: { jwtToken: token } });
    const res = createMockRes();
    process.env.APP_JWT_SECRET = 'testsecret';
    isAuthenticated(req, res, () => {
        nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(req.user.username, 'user');
});

test('should call next if valid JWT token in Authorization header', (t) => {
    let nextCalled = false;
    const token = jwt.sign({ username: 'user' }, 'testsecret');
    const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = createMockRes();
    process.env.APP_JWT_SECRET = 'testsecret';
    isAuthenticated(req, res, () => {
        nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(req.user.username, 'user');
});

test('should redirect to /auth/login if JWT token is invalid', (t) => {
    const req = createMockReq({ cookies: { jwtToken: 'invalidtoken' } });
    const res = createMockRes();
    process.env.APP_JWT_SECRET = 'testsecret';
    isAuthenticated(req, res, () => {});
    assert.strictEqual(res.redirectedUrl, '/auth/login');
    assert.strictEqual(req.session.returnTo, req.originalUrl);
});
