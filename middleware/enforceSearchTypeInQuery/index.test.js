import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SEARCH_TYPE } from '../../api/search/constants/searchTypes.js';
import enforceSearchTypeInQuery from './index.js';

/**
 * Creates a mock Express request object.
 *
 * @param {{ method?: string, query?: object, session?: object, originalUrl?: string }} [opts] - Optional request properties to override.
 * @returns {object}
 */
function createMockReq({ method = 'GET', query = {}, session = {}, originalUrl = '/search' } = {}) {
    return { method, query, session, originalUrl };
}

/**
 * Creates a mock Express response object with redirect tracking.
 *
 * @returns {object}
 */
function createMockRes() {
    let redirectedUrl = null;
    return {
        redirect(url) {
            redirectedUrl = url;
        },
        get redirectedUrl() {
            return redirectedUrl;
        }
    };
}

describe('enforceSearchTypeInQuery', () => {
    it('redirects with default type when type is absent from query', () => {
        const req = createMockReq({ query: { query: 'acute', crn: '26-711111' } });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(
            res.redirectedUrl,
            `/search?query=acute&crn=26-711111&type=${DEFAULT_SEARCH_TYPE}`
        );
        assert.strictEqual(nextCalled, false);
    });

    it('redirects with session type when set and type absent from query', () => {
        const req = createMockReq({
            query: { query: 'acute' },
            session: { featureFlags: { type: 'keyword' } }
        });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, '/search?query=acute&type=keyword');
        assert.strictEqual(nextCalled, false);
    });

    it('redirects with default type when session type is invalid and type absent from query', () => {
        const req = createMockReq({
            query: { query: 'acute' },
            session: { featureFlags: { type: 'old-value' } }
        });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, `/search?query=acute&type=${DEFAULT_SEARCH_TYPE}`);
        assert.strictEqual(nextCalled, false);
    });

    it('calls next without redirecting when type is present and valid in query', () => {
        const req = createMockReq({ query: { query: 'acute', type: 'hybrid' } });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, null);
        assert.strictEqual(nextCalled, true);
    });

    it('redirects to canonical form when type is valid but has non-canonical casing', () => {
        const req = createMockReq({ query: { query: 'acute', type: 'HYBRID' } });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.ok(res.redirectedUrl !== null, 'should redirect');
        assert.strictEqual(nextCalled, false);
        const redirected = new URL(res.redirectedUrl, 'http://localhost');
        assert.strictEqual(redirected.searchParams.get('type'), 'hybrid');
    });

    it('redirects to canonical form when type is valid but has surrounding whitespace', () => {
        const req = createMockReq({ query: { query: 'acute', type: ' keyword-dates ' } });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.ok(res.redirectedUrl !== null, 'should redirect');
        assert.strictEqual(nextCalled, false);
        const redirected = new URL(res.redirectedUrl, 'http://localhost');
        assert.strictEqual(redirected.searchParams.get('type'), 'keyword-dates');
    });

    it('uses the last value when type is supplied as an array with a valid final element', () => {
        const req = createMockReq({ query: { query: 'acute', type: ['invalid', 'keyword'] } });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, null);
        assert.strictEqual(nextCalled, true);
    });

    it('redirects to session/default when type is an array whose last element is invalid', () => {
        const req = createMockReq({
            query: { query: 'acute', type: ['keyword', 'not-a-type'] },
            session: { featureFlags: { type: 'semantic' } }
        });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, '/search?query=acute&type=semantic');
        assert.strictEqual(nextCalled, false);
    });

    it('redirects with session/default type when type is present but invalid', () => {
        const req = createMockReq({
            query: { query: 'acute', type: 'keyword,semantic' },
            session: { featureFlags: { type: 'keyword' } }
        });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, '/search?query=acute&type=keyword');
        assert.strictEqual(nextCalled, false);
    });

    it('calls next without redirecting for non-GET requests', () => {
        const req = createMockReq({ method: 'POST', query: {} });
        const res = createMockRes();
        let nextCalled = false;

        enforceSearchTypeInQuery(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.redirectedUrl, null);
        assert.strictEqual(nextCalled, true);
    });

    it('preserves all existing query params in the redirect', () => {
        const req = createMockReq({
            query: { query: 'brain injury', pageNumber: '2', crn: '26-711111' }
        });
        const res = createMockRes();

        enforceSearchTypeInQuery(req, res, () => {});

        const redirected = new URL(res.redirectedUrl, 'http://localhost');
        assert.strictEqual(redirected.searchParams.get('query'), 'brain injury');
        assert.strictEqual(redirected.searchParams.get('pageNumber'), '2');
        assert.strictEqual(redirected.searchParams.get('crn'), '26-711111');
        assert.strictEqual(redirected.searchParams.get('type'), DEFAULT_SEARCH_TYPE);
    });

    it('preserves the current request path in the redirect', () => {
        const req = createMockReq({
            query: { query: 'acute' },
            originalUrl: '/search/advanced?query=acute'
        });
        const res = createMockRes();

        enforceSearchTypeInQuery(req, res, () => {});

        assert.strictEqual(
            res.redirectedUrl,
            `/search/advanced?query=acute&type=${DEFAULT_SEARCH_TYPE}`
        );
    });
});
