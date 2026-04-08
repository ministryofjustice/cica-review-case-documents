import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import request from 'supertest';
import createSearchRouter from './routes.js';

describe('Search Pagination Persistence', () => {
    let app;
    let mockRenderHtml;
    let mockCreateSearchService;
    let sessionData;

    beforeEach(() => {
        sessionData = {};

        // Mock render function that captures template params
        mockRenderHtml = mock.fn((template, params) => {
            // Store params for inspection
            mockRenderHtml.lastParams = params;
            return `<html>${template}</html>`;
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
            createSearchService: mockCreateSearchService,
            renderHtml: mockRenderHtml
        });

        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Session middleware
        app.use((req, res, next) => {
            req.session = sessionData;
            req.session.caseSelected = true;
            req.session.caseReferenceNumber = '12-745678';
            req.log = { info: () => {}, error: () => {} };
            res.locals.csrfToken = 'test-csrf-token';
            res.locals.cspNonce = 'test-csp-nonce';
            next();
        });

        app.use('/search', searchRouter);
    });

    describe('Search results enrichment', () => {
        it('should pass document search context to result items', async () => {
            const res = await request(app).get('/search?query=test&pageNumber=3');

            assert.strictEqual(res.statusCode, 200);
            assert.ok(mockRenderHtml.lastParams);
            assert.ok(mockRenderHtml.lastParams.searchResults);

            const firstResult = mockRenderHtml.lastParams.searchResults[0];
            assert.strictEqual(firstResult.docUuid, 'doc-123');
            assert.strictEqual(firstResult.searchTerm, 'test');
            assert.strictEqual(firstResult.caseReferenceNumber, '12-745678');
        });

        it('should omit legacy back-link pagination context from result items', async () => {
            const res = await request(app).get('/search?query=test');

            assert.strictEqual(res.statusCode, 200);
            const firstResult = mockRenderHtml.lastParams.searchResults[0];
            assert.strictEqual(firstResult.searchResultsPageNumber, undefined);
            assert.strictEqual(firstResult.docUuid, 'doc-123');
            assert.strictEqual(firstResult.searchTerm, 'test');
            assert.strictEqual(firstResult.caseReferenceNumber, '12-745678');
            assert.deepStrictEqual(firstResult._source, {
                source_doc_id: 'doc-123',
                page_number: 5,
                correspondence_type: 'Letter',
                source_file_name: 'test.pdf',
                chunk_text: 'Test content'
            });
        });
    });

    describe('Pagination metadata', () => {
        it('should calculate pagination correctly for page 1', async () => {
            const res = await request(app).get('/search?query=test&pageNumber=1');

            assert.strictEqual(res.statusCode, 200);
            const pagination = mockRenderHtml.lastParams.pagination;
            assert.strictEqual(pagination.currentPageIndex, 1);
            assert.strictEqual(pagination.isFirstPage, true);
        });
    });
});
