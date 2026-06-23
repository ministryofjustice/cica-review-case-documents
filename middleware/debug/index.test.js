import assert from 'node:assert';
import { describe, it } from 'node:test';
import debugMiddleware, { finalizeDebugInfo, hasDebugContext, ifDebugContext } from './index.js';

describe('debugMiddleware', () => {
    it('should skip setup when debug flag is disabled', () => {
        const req = {
            method: 'GET',
            path: '/search',
            originalUrl: '/search',
            baseUrl: '/search',
            query: {},
            headers: {},
            session: {}
        };

        const res = {
            locals: {
                featureFlags: { debug: false }
            }
        };

        let nextCalled = false;
        debugMiddleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(res.locals.debugInfo, undefined);
    });

    it('should resolve mounted route using baseUrl when route path is /', () => {
        const req = {
            id: 'req-1',
            method: 'GET',
            path: '/',
            originalUrl: '/search?q=test',
            baseUrl: '/search',
            route: { path: '/' },
            query: { q: 'test' },
            headers: {},
            session: {
                caseReferenceNumber: '26-123456',
                username: 'user@example.com',
                caseSelected: true
            }
        };

        const res = {
            statusCode: 200,
            locals: {
                featureFlags: { debug: true },
                featureFlagProvenance: { debug: 'session' }
            }
        };

        let nextCalled = false;
        debugMiddleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(res.locals.debugInfo.request.route, '/search');

        // Ensure finalize also preserves mounted route resolution.
        res.locals.finalizeDebugInfo();
        assert.equal(res.locals.debugInfo.request.route, '/search');
    });

    it('should combine baseUrl and route path for nested mounted routes', () => {
        const req = {
            method: 'GET',
            path: '/results',
            originalUrl: '/search/results?q=test',
            baseUrl: '/search',
            route: { path: '/results' },
            query: { q: 'test' },
            headers: {},
            session: {}
        };

        const res = {
            statusCode: 200,
            locals: {
                featureFlags: { debug: true },
                featureFlagProvenance: {}
            }
        };

        debugMiddleware(req, res, () => {});

        assert.equal(res.locals.debugInfo.request.route, '/search/results');
    });

    it('should preserve existing route on finalize when route path is unavailable', () => {
        const req = {
            method: 'GET',
            path: '/search',
            originalUrl: '/search?q=test',
            baseUrl: '/search',
            route: { path: '/' },
            query: { q: 'test' },
            headers: {},
            session: {}
        };

        const res = {
            statusCode: 204,
            locals: {
                featureFlags: { debug: true },
                featureFlagProvenance: {}
            }
        };

        debugMiddleware(req, res, () => {});
        assert.equal(res.locals.debugInfo.request.route, '/search');

        // Simulate a point in lifecycle where req.route is no longer available.
        req.route = undefined;
        res.locals.finalizeDebugInfo({ responseStatus: 204 });

        assert.equal(res.locals.debugInfo.request.route, '/search');
        assert.equal(res.locals.debugInfo.request.responseStatus, 204);
        assert.ok(typeof res.locals.debugInfo.request.elapsedMs === 'number');
    });

    it('should safely return when debugInfo is missing during finalize', () => {
        const req = {
            method: 'GET',
            path: '/search',
            originalUrl: '/search',
            baseUrl: '/search',
            route: { path: '/' },
            query: {},
            headers: {},
            session: {}
        };

        const res = {
            statusCode: 200,
            locals: {
                featureFlags: { debug: true },
                featureFlagProvenance: {}
            }
        };

        debugMiddleware(req, res, () => {});
        delete res.locals.debugInfo;

        assert.doesNotThrow(() => res.locals.finalizeDebugInfo({ responseStatus: 200 }));
    });
});

describe('finalizeDebugInfo', () => {
    it('should call res.locals.finalizeDebugInfo when available', () => {
        let received = null;
        const res = {
            locals: {
                finalizeDebugInfo: (payload) => {
                    received = payload;
                }
            }
        };

        finalizeDebugInfo(res, 202);

        assert.deepStrictEqual(received, { responseStatus: 202 });
    });

    it('should safely no-op when finalize callback is missing', () => {
        const res = { locals: {} };

        assert.doesNotThrow(() => finalizeDebugInfo(res, 200));
    });
});

describe('hasDebugContext', () => {
    it('returns true when debug flag is on and debugInfo exists', () => {
        const res = {
            locals: {
                featureFlags: { debug: true },
                debugInfo: {}
            }
        };

        assert.equal(hasDebugContext(res), true);
    });

    it('returns false when debug flag is off', () => {
        const res = {
            locals: {
                featureFlags: { debug: false },
                debugInfo: {}
            }
        };

        assert.equal(hasDebugContext(res), false);
    });

    it('returns false when debugInfo is missing', () => {
        const res = {
            locals: {
                featureFlags: { debug: true }
            }
        };

        assert.equal(hasDebugContext(res), false);
    });
});

describe('ifDebugContext', () => {
    it('invokes updater when debug context exists', () => {
        const res = {
            locals: {
                featureFlags: { debug: true },
                debugInfo: { request: { route: '/search' } }
            }
        };

        ifDebugContext(res, (debugInfo) => {
            debugInfo.request.route = '/search/results';
        });

        assert.equal(res.locals.debugInfo.request.route, '/search/results');
    });

    it('does not invoke updater when debug context is absent', () => {
        const res = {
            locals: {
                featureFlags: { debug: false },
                debugInfo: { touched: false }
            }
        };
        let called = false;

        ifDebugContext(res, () => {
            called = true;
        });

        assert.equal(called, false);
        assert.equal(res.locals.debugInfo.touched, false);
    });
});
