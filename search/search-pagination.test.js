import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import request from 'supertest';
import createSearchRouter from './routes.js';

describe('Search Pagination Persistence', () => {
    let app;
    let mockCreateTemplateEngineService;
    let mockCreateSearchService;
    let mockRender;
    let sessionData;

    beforeEach(() => {
        sessionData = {};

        // Mock render function that captures template params
        mockRender = mock.fn((template, params) => {
            // Store params for inspection
            mockRender.lastParams = params;
            return `<html>${template}</html>`;
        });

        mockCreateTemplateEngineService = () => ({
            render: mockRender
        });

        mockCreateSearchService = () => ({
            getSearchResults: mock.fn(async () => ({
                body: {
                    data: {
                        attributes: {
                            results: {
                                hits: [
                                    {
                                        _source: {
                                            source_doc_id: 'doc-123',
                                            page_number: 5,
                                            correspondence_type: 'Letter',
                                            source_file_name: 'test.pdf',
                                            chunk_text: 'Test content'
                                        }
                                    }
                                ],
                                total: { value: 1 }
                            }
                        }
                    }
                }
            }))
        });

        const searchRouter = createSearchRouter({
            createTemplateEngineService: mockCreateTemplateEngineService,
            createSearchService: mockCreateSearchService
        });

        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Session middleware
        app.use((req, res, next) => {
            req.session = sessionData;
            req.session.caseSelected = true;
            req.session.caseReferenceNumber = '12-745678';
            req.cookies = { jwtToken: 'test-token' };
            req.log = { info: () => {}, error: () => {} };
            res.locals.csrfToken = 'test-csrf-token';
            res.locals.cspNonce = 'test-csp-nonce';
            next();
        });

        app.use('/search', searchRouter);
    });

    describe('Search results page with pageNumber', () => {
        it('should pass searchResultsPageNumber to result items', async () => {
            const res = await request(app).get('/search?query=test&pageNumber=3');

            assert.strictEqual(res.statusCode, 200);
            assert.ok(mockRender.lastParams);
            assert.ok(mockRender.lastParams.searchResults);

            // Check that searchResultsPageNumber is added to results
            const firstResult = mockRender.lastParams.searchResults[0];
            assert.strictEqual(firstResult.searchResultsPageNumber, 3);
        });

        it('should default to pageNumber 1 if not provided', async () => {
            const res = await request(app).get('/search?query=test');

            assert.strictEqual(res.statusCode, 200);
            const firstResult = mockRender.lastParams.searchResults[0];
            assert.strictEqual(firstResult.searchResultsPageNumber, 1);
        });
    });

    describe('Document links include searchResultsPageNumber', () => {
        it('should include searchResultsPageNumber in document page links', async () => {
            const res = await request(app).get('/search?query=test&pageNumber=5');

            assert.strictEqual(res.statusCode, 200);

            const result = mockRender.lastParams.searchResults[0];
            assert.strictEqual(result.searchResultsPageNumber, 5);
            assert.strictEqual(result._source.source_doc_id, 'doc-123');
            assert.strictEqual(result._source.page_number, 5);
        });
    });

    describe('Pagination metadata', () => {
        it('should calculate pagination correctly for page 1', async () => {
            const res = await request(app).get('/search?query=test&pageNumber=1');

            assert.strictEqual(res.statusCode, 200);
            const pagination = mockRender.lastParams.pagination;
            assert.strictEqual(pagination.currentPageIndex, 1);
            assert.strictEqual(pagination.isFirstPage, true);
        });
    });
});
