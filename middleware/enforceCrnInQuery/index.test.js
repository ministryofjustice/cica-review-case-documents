import assert from 'node:assert/strict';
import { test } from 'node:test';
import enforceCrnInQuery from './index.js';

/**
 * Creates a mock Express.js request object for testing purposes.
 *
 * @param {Object} [options] - Options to customize the mock request.
 * @param {string} [options.method='GET'] - The HTTP method of the request.
 * @param {Object} [options.query={}] - The query parameters of the request.
 * @param {Object} [options.session={}] - The session object attached to the request.
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
 * The mock object provides a `redirect` method to simulate HTTP redirects,
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

test('redirects to URL with crn when missing and case is selected', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-345678' }
    });
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    enforceCrnInQuery(req, res, next);

    assert.strictEqual(res.redirectedUrl, '/search?foo=bar&crn=12-345678');
    assert.strictEqual(nextCalled, false);
});

test('does not redirect if crn is present', () => {
    const req = createMockReq({
        method: 'GET',
        query: { crn: '12-345678', foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-345678' }
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
        session: { caseSelected: false, caseReferenceNumber: '12-345678' }
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
        session: { caseSelected: true, caseReferenceNumber: '12-345678' }
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
        session: { caseSelected: true, caseReferenceNumber: '12-345678' }
    });
    req.path = 'http://malicious.com/evil';
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
    assert.strictEqual(sentMsg, 'Invalid redirect path');
    assert.strictEqual(nextCalled, false);
});

test('blocks redirect if req.path contains suspicious patterns', () => {
    const req = createMockReq({
        method: 'GET',
        query: { foo: 'bar' },
        session: { caseSelected: true, caseReferenceNumber: '12-345678' }
    });
    req.path = '/search//evil';
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
    assert.strictEqual(sentMsg, 'Invalid redirect path');
    assert.strictEqual(nextCalled, false);
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
