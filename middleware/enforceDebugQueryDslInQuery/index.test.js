import assert from 'node:assert/strict';
import { test } from 'node:test';
import enforceDebugQueryDslInQuery from './index.js';

/**
 * Parses query parameters from a redirect URL string.
 *
 * @param {string | null} redirectedUrl - Full redirect URL.
 * @returns {URLSearchParams} Parsed query parameters.
 */
function getRedirectQueryParams(redirectedUrl) {
    const [, queryString = ''] = (redirectedUrl || '').split('?');
    return new URLSearchParams(queryString);
}

/**
 * Creates a minimal mock Express request object.
 *
 * @param {{ method?: string, path?: string, query?: object, session?: object }} [options] - Request options.
 * @returns {{ method: string, path: string, query: object, session: object }} Mock request.
 */
function createMockReq({ method = 'GET', path = '/search', query = {}, session = {} } = {}) {
    return { method, path, query, session };
}

/**
 * Creates a minimal mock Express response object that captures redirect calls.
 *
 * @returns {{ redirect: (url: string) => void, redirectedUrl: string | null }} Mock response.
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

test('redirects to add DSL tuning values when missing from query', () => {
    const req = createMockReq({
        session: {
            featureFlags: { debug: true },
            debugVariables: {
                semanticMinScore: 2.25,
                semanticOnlyMinScore: 0.5,
                semanticK: 250,
                lexicalBoost: 20,
                dateBoost: 60,
                neuralBoost: 4
            }
        }
    });
    const res = createMockRes();

    enforceDebugQueryDslInQuery(req, res, () => {});

    assert.ok(res.redirectedUrl?.startsWith('/search?'));

    const params = getRedirectQueryParams(res.redirectedUrl);
    assert.strictEqual(params.get('semanticMinScore'), '2.25');
    assert.strictEqual(params.get('semanticOnlyMinScore'), '0.5');
    assert.strictEqual(params.get('semanticK'), '250');
    assert.strictEqual(params.get('lexicalBoost'), '20');
    assert.strictEqual(params.get('dateBoost'), '60');
    assert.strictEqual(params.get('neuralBoost'), '4');
});

test('preserves existing query params and appends missing DSL params', () => {
    const req = createMockReq({
        query: { query: 'acute', type: 'hybrid-dates' },
        session: {
            featureFlags: { debug: true },
            debugVariables: {
                semanticMinScore: 2.25,
                semanticOnlyMinScore: 0.5,
                semanticK: 120,
                lexicalBoost: 20,
                dateBoost: 60,
                neuralBoost: 4
            }
        }
    });
    const res = createMockRes();

    enforceDebugQueryDslInQuery(req, res, () => {});

    assert.ok(res.redirectedUrl?.startsWith('/search?'));
    assert.ok(res.redirectedUrl?.includes('query=acute'));
    assert.ok(res.redirectedUrl?.includes('type=hybrid-dates'));
    const params = getRedirectQueryParams(res.redirectedUrl);
    assert.strictEqual(params.get('semanticMinScore'), '2.25');
    assert.strictEqual(params.get('semanticOnlyMinScore'), '0.5');
    assert.strictEqual(params.get('semanticK'), '120');
    assert.strictEqual(params.get('lexicalBoost'), '20');
    assert.strictEqual(params.get('dateBoost'), '60');
    assert.strictEqual(params.get('neuralBoost'), '4');
});

test('does not redirect when debug mode is off', () => {
    const req = createMockReq({
        session: {
            featureFlags: { debug: false },
            debugVariables: { dateBoost: 60 }
        }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceDebugQueryDslInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('does not redirect when all DSL params are already in query', () => {
    const req = createMockReq({
        query: {
            semanticMinScore: '2.25',
            semanticOnlyMinScore: '0.5',
            semanticK: '120',
            lexicalBoost: '20',
            dateBoost: '60',
            neuralBoost: '4'
        },
        session: {
            featureFlags: { debug: true },
            debugVariables: {
                semanticMinScore: 2.25,
                semanticOnlyMinScore: 0.5,
                semanticK: 120,
                lexicalBoost: 20,
                dateBoost: 60,
                neuralBoost: 4
            }
        }
    });
    const res = createMockRes();
    let nextCalled = false;

    enforceDebugQueryDslInQuery(req, res, () => {
        nextCalled = true;
    });

    assert.strictEqual(res.redirectedUrl, null);
    assert.strictEqual(nextCalled, true);
});

test('applies to document view page path', () => {
    const req = createMockReq({
        path: '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1',
        session: {
            featureFlags: { debug: true },
            debugVariables: {
                semanticMinScore: 2.25,
                semanticOnlyMinScore: 0.5,
                semanticK: 250,
                lexicalBoost: 20,
                dateBoost: 60,
                neuralBoost: 4
            }
        }
    });
    const res = createMockRes();

    enforceDebugQueryDslInQuery(req, res, () => {});

    assert.strictEqual(
        res.redirectedUrl,
        '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1?semanticMinScore=2.25&semanticOnlyMinScore=0.5&semanticK=250&lexicalBoost=20&dateBoost=60&neuralBoost=4'
    );
});

test('blocks redirect for non-allowed paths', () => {
    const req = createMockReq({
        path: '/admin/secret',
        session: {
            featureFlags: { debug: true },
            debugVariables: { dateBoost: 60 }
        }
    });
    let nextArg;

    enforceDebugQueryDslInQuery(req, {}, (err) => {
        nextArg = err;
    });

    assert(nextArg instanceof Error);
    assert.strictEqual(nextArg.message, 'Redirect not allowed for this path');
    assert.strictEqual(nextArg.status, 400);
});
