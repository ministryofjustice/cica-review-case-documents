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
            caseReferenceNumber: '12-345678',
            createRequestService: mockCreateRequestService,
            logger: fakeLogger // <-- use 'logger' here
        });
        const query = 'example';
        const pageNumber = 2;
        const itemsPerPage = 5;

        const req = { headers: { cookie: 'session=abc123' } };
        const result = await service.getSearchResults(query, pageNumber, itemsPerPage, req);

        assert.deepEqual(result, { body: { data: 'fake results' } });
        assert.equal(mockCreateRequestService.mock.callCount(), 1);
        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/?query=${query}&pageNumber=${pageNumber}&itemsPerPage=${itemsPerPage}`
        );
        assert.equal(mockGetCallArguments.headers['On-Behalf-Of'], '12-345678');
    });
});
