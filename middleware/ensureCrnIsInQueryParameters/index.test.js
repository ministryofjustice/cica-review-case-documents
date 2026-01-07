import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import ensureCrnIsInQueryParameters from './index.js';

describe('ensureCrnIsInQueryParameters', () => {
    describe('GET requests', () => {
        describe('When case is selected and crn is missing from query', () => {
            it('Should redirect with CRN added to query string', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        page: '1'
                    },
                    session: {
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 1);
                assert.strictEqual(
                    res.redirect.mock.calls[0].arguments[0],
                    '/search?page=1&crn=25-123456'
                );
                assert.strictEqual(next.mock.callCount(), 0);
            });

            it('Should replace caseReferenceNumber with CRN in query string', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        caseReferenceNumber: '25-111111',
                        page: '2'
                    },
                    session: {
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 1);
                const redirectUrl = res.redirect.mock.calls[0].arguments[0];
                assert.match(redirectUrl, /crn=25-123456/);
                assert.doesNotMatch(redirectUrl, /caseReferenceNumber/);
                assert.strictEqual(next.mock.callCount(), 0);
            });

            it('Should preserve existing query parameters', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        page: '1',
                        sort: 'date',
                        filter: 'active'
                    },
                    session: {
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 1);
                const redirectUrl = res.redirect.mock.calls[0].arguments[0];
                assert.match(redirectUrl, /page=1/);
                assert.match(redirectUrl, /sort=date/);
                assert.match(redirectUrl, /filter=active/);
                assert.match(redirectUrl, /crn=25-123456/);
                assert.strictEqual(next.mock.callCount(), 0);
            });

            it('Should handle empty query object', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {},
                    session: {
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 1);
                assert.strictEqual(
                    res.redirect.mock.calls[0].arguments[0],
                    '/search?crn=25-123456'
                );
                assert.strictEqual(next.mock.callCount(), 0);
            });
        });

        describe('When case is selected and CRN is present in query', () => {
            it('Should call next without redirecting', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        crn: '25-123456',
                        page: '1'
                    },
                    session: {
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 0);
                assert.strictEqual(next.mock.callCount(), 1);
            });
        });

        describe('When case is not selected', () => {
            it('Should call next without redirecting when caseSelected is false', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        page: '1'
                    },
                    session: {
                        caseSelected: false
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 0);
                assert.strictEqual(next.mock.callCount(), 1);
            });

            it('Should call next without redirecting when caseSelected is undefined', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        page: '1'
                    },
                    session: {}
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 0);
                assert.strictEqual(next.mock.callCount(), 1);
            });

            it('Should call next without redirecting when session is undefined', () => {
                const req = {
                    method: 'GET',
                    baseUrl: '/search',
                    query: {
                        page: '1'
                    }
                };
                const res = { redirect: mock.fn() };
                const next = mock.fn();

                ensureCrnIsInQueryParameters(req, res, next);

                assert.strictEqual(res.redirect.mock.callCount(), 0);
                assert.strictEqual(next.mock.callCount(), 1);
            });
        });
    });

    describe('Non-GET requests', () => {
        it('Should call next for POST request', () => {
            const req = {
                method: 'POST',
                baseUrl: '/search',
                query: {},
                session: {
                    caseSelected: true,
                    caseReferenceNumber: '25-123456'
                }
            };
            const res = { redirect: mock.fn() };
            const next = mock.fn();

            ensureCrnIsInQueryParameters(req, res, next);

            assert.strictEqual(res.redirect.mock.callCount(), 0);
            assert.strictEqual(next.mock.callCount(), 1);
        });

        it('Should call next for PUT request', () => {
            const req = {
                method: 'PUT',
                baseUrl: '/search',
                query: {},
                session: {
                    caseSelected: true,
                    caseReferenceNumber: '25-123456'
                }
            };
            const res = { redirect: mock.fn() };
            const next = mock.fn();

            ensureCrnIsInQueryParameters(req, res, next);

            assert.strictEqual(res.redirect.mock.callCount(), 0);
            assert.strictEqual(next.mock.callCount(), 1);
        });

        it('Should call next for DELETE request', () => {
            const req = {
                method: 'DELETE',
                baseUrl: '/search',
                query: {},
                session: {
                    caseSelected: true,
                    caseReferenceNumber: '25-123456'
                }
            };
            const res = { redirect: mock.fn() };
            const next = mock.fn();

            ensureCrnIsInQueryParameters(req, res, next);

            assert.strictEqual(res.redirect.mock.callCount(), 0);
            assert.strictEqual(next.mock.callCount(), 1);
        });
    });

    describe('Edge cases', () => {
        it('Should handle query object with undefined value', () => {
            const req = {
                method: 'GET',
                baseUrl: '/search',
                query: undefined,
                session: {
                    caseSelected: true,
                    caseReferenceNumber: '25-123456'
                }
            };
            const res = { redirect: mock.fn() };
            const next = mock.fn();

            ensureCrnIsInQueryParameters(req, res, next);

            assert.strictEqual(res.redirect.mock.callCount(), 1);
            assert.strictEqual(next.mock.callCount(), 0);
        });

        it('Should handle empty baseUrl', () => {
            const req = {
                method: 'GET',
                baseUrl: '',
                query: {},
                session: {
                    caseSelected: true,
                    caseReferenceNumber: '25-123456'
                }
            };
            const res = { redirect: mock.fn() };
            const next = mock.fn();

            ensureCrnIsInQueryParameters(req, res, next);

            assert.strictEqual(res.redirect.mock.callCount(), 1);
            assert.strictEqual(res.redirect.mock.calls[0].arguments[0], '?crn=25-123456');
            assert.strictEqual(next.mock.callCount(), 0);
        });
    });
});
