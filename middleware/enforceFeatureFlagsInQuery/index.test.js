import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SEARCH_TYPE } from '../../api/search/constants/searchTypes.js';
import enforceFeatureFlagsInQuery from './index.js';

/**
 * Creates a mock Express request object for testing purposes.
 *
 * @param {Object} [options] - Options to customise the mock request.
 * @param {string} [options.method='GET'] - The HTTP method of the request.
 * @param {string} [options.path='/search'] - The request path.
 * @param {Object} [options.query={}] - The query parameters of the request.
 * @param {Object} [options.session={}] - The session object of the request.
 * @returns {Object} Mock request object.
 */
function createMockReq({ method = 'GET', path = '/search', query = {}, session = {} } = {}) {
    return { method, path, query, session };
}

/**
 * Creates a mock response object that captures any URL passed to `redirect`.
 *
 * @returns {{ redirect: function(string): void, redirectedUrl: string|null }}
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

// ---------------------------------------------------------------------------
// Core redirect behaviour
// ---------------------------------------------------------------------------

test('redirects to URL with non-default boolean flag when missing from query', () => {
    const req = createMockReq({
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, '/search?align=off');
    assert.strictEqual(nextCalled, false);
});

test('redirects to URL with non-default string flag when missing from query', () => {
    const req = createMockReq({
        session: { featureFlags: { align: true, type: 'hybrid' } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    assert.strictEqual(res.redirectedUrl, '/search?type=hybrid');
});

test('redirects with multiple non-default flags appended', () => {
    const req = createMockReq({
        session: { featureFlags: { align: false, type: 'hybrid' } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    // Both non-default flags must be present (order may vary via URLSearchParams)
    assert.ok(res.redirectedUrl?.includes('align=off'), 'should include align=off');
    assert.ok(res.redirectedUrl?.includes('type=hybrid'), 'should include type=hybrid');
    assert.ok(res.redirectedUrl?.startsWith('/search?'), 'should start with /search?');
});

test('preserves existing query parameters when redirecting', () => {
    const req = createMockReq({
        query: { crn: '12-745678', page: '2' },
        session: { featureFlags: { align: true, type: 'hybrid' } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    assert.ok(res.redirectedUrl?.includes('crn=12-745678'));
    assert.ok(res.redirectedUrl?.includes('page=2'));
    assert.ok(res.redirectedUrl?.includes('type=hybrid'));
});

// ---------------------------------------------------------------------------
// No-redirect conditions
// ---------------------------------------------------------------------------

test('does not redirect when all non-default flags are already in the query', () => {
    const req = createMockReq({
        query: { type: 'hybrid' },
        session: { featureFlags: { align: true, type: 'hybrid' } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect when all flags are at their defaults', () => {
    const req = createMockReq({
        session: { featureFlags: { align: true, type: DEFAULT_SEARCH_TYPE } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect when session has no featureFlags', () => {
    const req = createMockReq({ session: {} });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect for non-GET requests', () => {
    const req = createMockReq({
        method: 'POST',
        session: { featureFlags: { align: false, type: 'hybrid' } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

// ---------------------------------------------------------------------------
// Allowed path patterns
// ---------------------------------------------------------------------------

test('redirects for document view page path', () => {
    const req = createMockReq({
        path: '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    assert.strictEqual(
        res.redirectedUrl,
        '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1?align=off'
    );
});

test('redirects for document image streaming endpoint', () => {
    const req = createMockReq({
        path: '/document/123e4567-e89b-12d3-a456-426614174000/page/5',
        session: { featureFlags: { align: true, type: 'hybrid' } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    assert.strictEqual(
        res.redirectedUrl,
        '/document/123e4567-e89b-12d3-a456-426614174000/page/5?type=hybrid'
    );
});

test('normalises trailing slash before checking allowed path', () => {
    const req = createMockReq({
        path: '/search/',
        query: { crn: '12-745678' },
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    const res = createMockRes();

    enforceFeatureFlagsInQuery(req, res, () => {});

    assert.strictEqual(res.redirectedUrl, '/search?crn=12-745678&align=off');
});

// ---------------------------------------------------------------------------
// Path security guards
// ---------------------------------------------------------------------------

test('blocks redirect for path not in allowed list or patterns', () => {
    const req = createMockReq({
        path: '/admin/secret',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Redirect not allowed for this path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for absolute http:// path', () => {
    const req = createMockReq({
        path: 'http://malicious.com/search',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for absolute https:// path', () => {
    const req = createMockReq({
        path: 'https://evil.com/search',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for path containing double slashes', () => {
    const req = createMockReq({
        path: '/search//evil',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for path containing backslash', () => {
    const req = createMockReq({
        path: '/search\\evil',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

test('blocks redirect for path containing double dots', () => {
    const req = createMockReq({
        path: '/search/../admin',
        session: { featureFlags: { align: false, type: DEFAULT_SEARCH_TYPE } }
    });
    let nextArg;

    enforceFeatureFlagsInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Invalid redirect path');
    assert.strictEqual(nextArg.status, 400);
});

// ---------------------------------------------------------------------------
// Excluded paths (static assets)
// ---------------------------------------------------------------------------

test('skips enforcement for favicon', () => {
    const req = createMockReq({
        path: '/favicon.ico',
        session: { featureFlags: { align: false, type: 'hybrid' } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('skips enforcement for public assets', () => {
    const req = createMockReq({
        path: '/public/style.css',
        session: { featureFlags: { align: false, type: 'hybrid' } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('skips enforcement for js bundle files', () => {
    const req = createMockReq({
        path: '/js/bundle.js',
        session: { featureFlags: { align: false, type: 'hybrid' } }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceFeatureFlagsInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});
