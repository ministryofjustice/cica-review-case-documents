import assert from 'node:assert/strict';
import { test } from 'node:test';
import enforceCrnInQuery from './index.js';

function createMockReq({ method = 'GET', query = {}, session = {} } = {}) {
    return {
        method,
        query,
        session,
        path: '/search'
    };
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
