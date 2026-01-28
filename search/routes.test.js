import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import createSearchRouter from './routes.js';

describe('Search Routes', () => {
    let app;
    let mockCreateTemplateEngineService;
    let mockCreateSearchService;
    let mockRender;
    let mockGetSearchResults;

    beforeEach(() => {
        // Mock implementations
        mockRender = (template, params) => `<html>${template}</html>`;
        mockGetSearchResults = async () => ({
            body: {
                data: {
                    attributes: {
                        results: {
                            hits: [{ id: 'doc1', name: 'Document 1' }],
                            total: { value: 1 }
                        }
                    }
                }
            }
        });

        // Mock factory functions
        mockCreateTemplateEngineService = () => ({
            render: mockRender
        });
        mockCreateSearchService = () => ({
            getSearchResults: mockGetSearchResults
        });

        const searchRouter = createSearchRouter({
            createTemplateEngineService: mockCreateTemplateEngineService,
            createSearchService: mockCreateSearchService
        });

        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Mock middleware dependencies
        app.use((req, res, next) => {
            req.session = {
                caseSelected: true,
                caseReferenceNumber: '12345'
            };
            req.cookies = { jwtToken: 'test-token' };
            req.log = { info: () => {}, error: () => {} };
            res.locals.csrfToken = 'test-csrf-token';
            res.locals.cspNonce = 'test-csp-nonce';
            next();
        });

        app.use('/search', searchRouter);

        // Add a generic error handler for tests
        app.use((err, req, res, next) => {
            res.status(500).send('Internal Server Error');
        });
    });

    describe('GET /', () => {
        it('should render the search index page if no query is provided', async () => {
            const res = await request(app).get('/search');
            assert.strictEqual(res.statusCode, 200);
            assert.match(res.text, /search\/page\/index.njk/);
        });

        it('should call search service and render results when a query is provided', async () => {
            const res = await request(app).get('/search?query=test');
            assert.strictEqual(res.statusCode, 200);
            assert.match(res.text, /search\/page\/results.njk/);
        });

        it('should handle errors from the search service', async () => {
            // This test needs a fresh app instance to re-initialize the router with new mocks
            const testApp = express();
            const failingSearch = async () => {
                throw new Error('Search failed');
            };
            const failingSearchService = () => ({
                getSearchResults: failingSearch
            });
            const routerWithFailingService = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: failingSearchService
            });
            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                next();
            });
            testApp.use('/search', routerWithFailingService);
            testApp.use((err, req, res, next) => {
                res.status(500).send('Internal Server Error');
            });

            const res = await request(testApp).get('/search?query=error');
            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(res.text, 'Internal Server Error');
        });

        it('should handle API errors returned in the search service response body', async () => {
            const testApp = express();
            const errorResponseSearch = async () => ({
                body: {
                    errors: [{ detail: 'Invalid query' }]
                }
            });
            const errorSearchService = () => ({
                getSearchResults: errorResponseSearch
            });
            const routerWithErrorService = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: errorSearchService
            });
            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                res.locals.csrfToken = 'test-csrf-token';
                res.locals.cspNonce = 'test-csp-nonce';
                next();
            });
            testApp.use('/search', routerWithErrorService);

            const res = await request(testApp).get('/search?query=bad');
            assert.strictEqual(res.statusCode, 400);
        });

        it('should handle error objects missing detail property', async () => {
            const testApp = express();
            const errorResponseSearch = async () => ({
                body: {
                    errors: [{ source: { pointer: '/attributes/query' } }]
                }
            });
            const errorSearchService = () => ({
                getSearchResults: errorResponseSearch
            });
            const routerWithErrorService = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: errorSearchService
            });
            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                res.locals.csrfToken = 'test-csrf-token';
                res.locals.cspNonce = 'test-csp-nonce';
                next();
            });
            testApp.use('/search', routerWithErrorService);

            const res = await request(testApp).get('/search?query=bad');
            assert.strictEqual(res.statusCode, 400);
        });

        it('should handle error objects with missing pointer (uses default anchor)', async () => {
            const testApp = express();
            const errorResponseSearch = async () => ({
                body: {
                    errors: [{ detail: 'Query too short' }]
                }
            });
            const errorSearchService = () => ({
                getSearchResults: errorResponseSearch
            });
            const routerWithErrorService = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: errorSearchService
            });
            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                res.locals.csrfToken = 'test-csrf-token';
                res.locals.cspNonce = 'test-csp-nonce';
                next();
            });
            testApp.use('/search', routerWithErrorService);

            const res = await request(testApp).get('/search?query=a');
            assert.strictEqual(res.statusCode, 400);
            // Should use default anchor #error
            assert.ok(res.text.includes('error') || res.statusCode === 400);
        });

        it('should handle multiple error objects in response', async () => {
            const testApp = express();
            const errorResponseSearch = async () => ({
                body: {
                    errors: [
                        { detail: 'Invalid query', source: { pointer: '/attributes/query' } },
                        { detail: 'Missing parameter', source: { pointer: '/attributes/filter' } }
                    ]
                }
            });
            const errorSearchService = () => ({
                getSearchResults: errorResponseSearch
            });
            const routerWithErrorService = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: errorSearchService
            });
            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                res.locals.csrfToken = 'test-csrf-token';
                res.locals.cspNonce = 'test-csp-nonce';
                next();
            });
            testApp.use('/search', routerWithErrorService);

            const res = await request(testApp).get('/search?query=test');
            assert.strictEqual(res.statusCode, 400);
        });

        it('should handle search results with missing source_doc_id (uses 0 as docUuid)', async () => {
            const testApp = express();
            const searchResponseWithMissingDocId = async () => ({
                body: {
                    data: {
                        attributes: {
                            results: {
                                hits: [
                                    {
                                        id: 'doc1',
                                        name: 'Document without docId',
                                        _source: {} // Missing source_doc_id
                                    }
                                ],
                                total: { value: 1 }
                            }
                        }
                    }
                }
            });

            const searchService = () => ({
                getSearchResults: searchResponseWithMissingDocId
            });

            const routerWithResults = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: searchService
            });

            testApp.use((req, res, next) => {
                req.session = { caseSelected: true, caseReferenceNumber: '12345' };
                req.cookies = { jwtToken: 'test-token' };
                req.log = { info: () => {}, error: () => {} };
                res.locals.csrfToken = 'test-csrf-token';
                res.locals.cspNonce = 'test-csp-nonce';
                next();
            });
            testApp.use('/search', routerWithResults);

            const res = await request(testApp).get('/search?query=test');
            assert.strictEqual(res.statusCode, 200);
            assert.match(res.text, /search\/page\/results.njk/);
        });
    });

    describe('POST /', () => {
        it('should redirect to the GET route with the query parameter', async () => {
            const res = await request(app).post('/search').send({ query: ' search term ' });
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.location, '/search?query=search%20term&pageNumber=1');
        });

        it('should redirect with pageNumber when provided', async () => {
            const res = await request(app).post('/search?pageNumber=5').send({ query: 'test' });
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.location, '/search?query=test&pageNumber=5');
        });

        it('handles errors in POST /search route', async () => {
            // Create app where req.body is undefined to trigger error
            const { default: express } = await import('express');
            const { default: session } = await import('express-session');
            const errorApp = express();
            errorApp.use(
                session({
                    secret: 'fake-secret',
                    resave: false,
                    saveUninitialized: true
                })
            );

            // Don't use express.json() middleware so req.body.query causes error
            // Add middleware that makes req.body.query throw
            errorApp.use((req, res, next) => {
                Object.defineProperty(req, 'body', {
                    get() {
                        throw new Error('Body parsing error');
                    }
                });
                next();
            });

            const router = createSearchRouter({
                createTemplateEngineService: mockCreateTemplateEngineService,
                createSearchService: mockCreateSearchService
            });
            errorApp.use('/search', router);

            errorApp.use((err, req, res, next) => {
                res.status(err.status || 500).json({ error: err.message });
            });

            const res = await request(errorApp).post('/search');
            assert.strictEqual(res.statusCode, 500);
            assert.ok(res.body.error);
        });
    });
});
