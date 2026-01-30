import assert from 'node:assert/strict';
import { test } from 'node:test';
import enforceCrnInQuery from './index.js';

/**
 * Creates a mock Express request object for testing purposes.
 *
 * @param {Object} [options] - Options to customize the mock request.
 * @param {string} [options.method='GET'] - The HTTP method of the request.
 * @param {Object} [options.query={}] - The query parameters of the request.
 * @param {Object} [options.session={}] - The session object of the request.
 * @returns {Object} Mock request object with method, query, session, and path properties.
 */
function createMockReq({ method = 'GET', query = {}, session = {} } = {}) {
    return {
        method,
        query,
        session,
        path: '/search'
    };
}

/**
 * Creates a mock response object for testing purposes.
 * The mock object captures any URL passed to its `redirect` method,
 * allowing tests to assert redirection behavior.
 *
 * @returns {{redirect: function(string): void, redirectedUrl: string|null}}
 *   An object with a `redirect` method to simulate redirection and a `redirectedUrl` property to retrieve the redirected URL.
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

test('redirects to URL with crn when missing and case is selected', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, '/search?foo=bar&crn=12-745678');
    assert.strictEqual(nextCalled, false);
});

test('does not redirect if crn is present', () => {
    const req = createMockReq({
        method: 'GET',
        query: { crn: '12-745678', foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect if case is not selected', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: false, caseReferenceNumber: '12-745678' }
    });
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect for non-GET requests', () => {
    const req = createMockReq({
        method: 'POST',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('blocks redirect if req.path is absolute URL', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = 'http://malicious.com/evil';
    let nextArg;
    const res = {};
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect if req.path contains suspicious patterns', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/search//evil';
    let nextArg;
    const res = {};
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect if crn is invalid', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-34!@#' }
    });
    req.path = '/search';
    let statusCode, sentMsg;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        send(msg) {
            sentMsg = msg;
            return this;
        }
    };
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(sentMsg, 'Invalid case reference number');
    assert.strictEqual(nextCalled, false);
});

test('blocks redirect if path is not in allowed list', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/unauthorized-path';
    let nextArg;
    const res = {};
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Redirect not allowed for this path');
    assert.strictEqual(nextArg.status, 400);
});

test('allows redirect for path matching allowed patterns', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(
        res.redirectedUrl,
        '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1?foo=bar&crn=12-745678'
    );
    assert.strictEqual(nextCalled, false);
});

test('allows redirect for image streaming endpoint pattern', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/document/123e4567-e89b-12d3-a456-426614174000/page/5';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(
        res.redirectedUrl,
        '/document/123e4567-e89b-12d3-a456-426614174000/page/5?crn=12-745678'
    );
    assert.strictEqual(nextCalled, false);
});

test('skips enforcement for excluded paths - favicon', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/favicon.ico';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('skips enforcement for excluded paths - public assets', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/public/style.css';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('skips enforcement for excluded paths - js files', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/js/app.js';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('normalizes path with trailing slash before checking', () => {
    const req = createMockReq({
        method: 'GET',
        query: { test: 'value' },
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/search/';
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, '/search?test=value&crn=12-745678');
    assert.strictEqual(nextCalled, false);
});

test('blocks redirect for invalid CRN with special characters', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-34;DROP TABLE' }
    });
    req.path = '/search';
    const res = {
        status: (code) => ({
            send: (msg) => {
                res.statusCode = code;
                res.body = msg;
            }
        })
    };
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body, 'Invalid case reference number');
    assert.strictEqual(nextCalled, false);
});

test('blocks redirect for path not in allowed list or patterns', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/admin/secret';
    const res = {};
    let nextArg;
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Redirect not allowed for this path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for path with backslash', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/search\\evil';
    const res = {};
    let nextArg;
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for path with double dots', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = '/search/../admin';
    const res = {};
    let nextArg;
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for https:// in path', () => {
    const req = createMockReq({
        method: 'GET',
        query: {},
        session: { caseSelected: true, caseReferenceNumber: '12-745678' }
    });
    req.path = 'https://evil.com/search';
    const res = {};
    let nextArg;
    const next = (err) => {
        nextArg = err;
    };

    enforceCrnInQuery(req, res, next);

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});
