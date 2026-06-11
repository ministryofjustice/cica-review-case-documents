import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

import createSearchService from './search-service.js';

describe('search-service', () => {
    let mockGet;
    let mockCreateRequestService;

    beforeEach(() => {
        mockGet = mock.fn(() => {
            return {
                body: {
                    data: 'fake results'
                }
            };
        });

        mockCreateRequestService = mock.fn(() => {
            return {
                get: mockGet
            };
        });
    });

    it('Should call get with correct URL and headers', async () => {
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
        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/?${new URLSearchParams({
                query,
                pageNumber: String(pageNumber),
                itemsPerPage: String(itemsPerPage),
                type: 'semantic'
            }).toString()}`
        );
        assert.equal(mockGetCallArguments.headers['On-Behalf-Of'], '12-745678');
    });

    it('Should encode searchType in URL query string', async () => {
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

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/?${new URLSearchParams({
                query,
                pageNumber: String(pageNumber),
                itemsPerPage: String(itemsPerPage),
                type: injectedSearchType
            }).toString()}`
        );
        assert.equal(mockGetCallArguments.url.includes('&debug=on'), false);
    });

    it('Should encode query to prevent query-string injection', async () => {
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

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/?${new URLSearchParams({
                query,
                pageNumber: '1',
                itemsPerPage: '10',
                type: 'semantic'
            }).toString()}`
        );
        assert.equal(mockGetCallArguments.url.includes('&debug=on'), false);
    });

    it('Should encode spaces in query as %20 for API compatibility', async () => {
        const fakeLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
        const service = createSearchService({
            caseReferenceNumber: '12-745678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger
        });

        await service.getSearchResults('acute november 2022', 1, 10, undefined, {
            searchType: 'hybrid-dates'
        });

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/?query=acute%20november%202022&pageNumber=1&itemsPerPage=10&type=hybrid-dates`
        );
        assert.equal(mockGetCallArguments.url.includes('acute+november+2022'), false);
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

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(mockGetCallArguments.headers['X-Debug-Context'], 'true');
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

        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.headers['X-Query-DSL-Config'],
            JSON.stringify(queryDslConfig)
        );
    });
});
