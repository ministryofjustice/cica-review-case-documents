import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import request from 'supertest';
import createApiRouter from './routes.js';

describe('API Document Routes', () => {
    let app;
    let mockSearchService;

    beforeEach(() => {
        // Mock search service
        mockSearchService = {
            getSearchResultsByKeyword: mock.fn(async () => ({
                total: { value: 0 },
                hits: []
            }))
        };

        // Create router with mocks
        const router = createApiRouter({
            searchService: mockSearchService
        });

        // Setup Express app
        app = express();

        // Mock request logger
        app.use((req, res, next) => {
            req.log = {
                info: mock.fn(),
                error: mock.fn()
            };
            next();
        });

        app.use('/', router);
    });

    describe('API Router Configuration', () => {
        it('should mount the search router at /search', async () => {
            const res = await request(app)
                .get('/search?query=test&pageNumber=1&crn=12-745678')
                .set('On-Behalf-Of', '12-745678');

            // Will get 200 or similar, but not 404 (route exists)
            assert.notStrictEqual(res.statusCode, 404);
        });

        it('should not have document streaming routes (moved to main app)', async () => {
            const res = await request(app).get('/documents/12-745678/doc-123/pages/5');

            // Route should not exist in API anymore
            assert.strictEqual(res.statusCode, 404);
        });
    });
});
