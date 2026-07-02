import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

import createSearchService from './search-service.js';

describe('search-service', () => {
    let mockPost;
    let mockCreateRequestService;

    beforeEach(() => {
        mockPost = mock.fn(() => {
            return {
                body: {
                    data: 'fake results'
                }
            };
        });

        mockCreateRequestService = mock.fn(() => {
            return {
                post: mockPost
            };
        });
    });

    it('Should call post with correct URL, body and headers', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger // <-- use 'logger' here
        });
        const query = 'example';
        const pageNumber = 2;
        const itemsPerPage = 5;

        const result = await service.getSearchResults(query, pageNumber, itemsPerPage, undefined, {
            searchType: 'semantic'
        });

        assert.deepEqual(result, { body: { data: 'fake results' } });
        assert.equal(mockCreateRequestService.mock.callCount(), 1);
        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(mockPostCallArguments.url, `${process.env.APP_API_URL}/search/`);
        assert.deepEqual(mockPostCallArguments.json, {
            query,
            pageNumber,
            itemsPerPage,
            type: 'semantic'
        });
        assert.equal(mockPostCallArguments.headers['On-Behalf-Of'], '12-745678');
    });

    it('Should send searchType in request body as a plain value', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        const query = 'example';
        const pageNumber = 1;
        const itemsPerPage = 10;
        const injectedSearchType = 'semantic&debug=on';

        await service.getSearchResults(query, pageNumber, itemsPerPage, undefined, {
            searchType: injectedSearchType
        });

        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(mockPostCallArguments.url, `${process.env.APP_API_URL}/search/`);
        assert.equal(mockPostCallArguments.json.type, injectedSearchType);
    });

    it('Should send query in request body', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        const query = 'x&debug=on';

        await service.getSearchResults(query, 1, 10, undefined, {
            searchType: 'semantic'
        });

        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(mockPostCallArguments.url, `${process.env.APP_API_URL}/search/`);
        assert.equal(mockPostCallArguments.json.query, query);
    });

    it('Should keep spaces in query payload value', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        await service.getSearchResults('acute november 2022', 1, 10, undefined, {
            searchType: 'hybrid-dates'
        });

        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(mockPostCallArguments.json.query, 'acute november 2022');
    });

    it('Should include X-Debug-Context header when includeNamedQueries is true', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        await service.getSearchResults('example', 1, 10, undefined, {
            searchType: 'hybrid',
            includeNamedQueries: true
        });

        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(mockPostCallArguments.headers['X-Debug-Context'], 'true');
    });

    it('Should include X-Query-DSL-Config header when queryDslConfig is provided', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        const queryDslConfig = {
            semanticMinScore: 0.8,
            semanticOnlyMinScore: 0.35,
            semanticK: 120,
            lexicalBoost: 12,
            dateBoost: 2,
            neuralBoost: 3
        };

        await service.getSearchResults('example', 1, 10, undefined, {
            searchType: 'hybrid',
            includeNamedQueries: true,
            queryDslConfig
        });

        const mockPostCallArguments = mockPost.mock.calls[0].arguments[0];
        assert.equal(
            mockPostCallArguments.headers['X-Query-DSL-Config'],
            JSON.stringify(queryDslConfig)
        );
    });

    it('Should not throw when logger is not provided', async () => {
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService
        });

        const result = await service.getSearchResults('example', 1, 10, undefined, {
            searchType: 'semantic'
        });

        assert.deepEqual(result, { body: { data: 'fake results' } });
        assert.equal(mockPost.mock.callCount(), 1);
    });
});
