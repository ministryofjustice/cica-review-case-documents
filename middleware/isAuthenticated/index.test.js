import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import isAuthenticated from './index.js';

function createMockReq({
    session = {},
    cookies = {},
    headers = {},
    log = { warn: () => {} },
    originalUrl = '/test'
} = {}) {
    return { session, cookies, headers, log, originalUrl };
}

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
