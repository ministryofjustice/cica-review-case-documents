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
        const service = createSearchService({
            caseReferenceNumber: '12-345678',
            createRequestService: mockCreateRequestService
        });
        const query = 'example';
        const pageNumber = 2;
        const itemsPerPage = 5;

        const result = await service.getSearchResults(query, pageNumber, itemsPerPage);
        assert.deepEqual(result, { body: { data: 'fake results' } });
        assert.equal(mockCreateRequestService.mock.callCount(), 1);
        const mockGetCallArguments = mockGet.mock.calls[0].arguments[0];
        assert.equal(
            mockGetCallArguments.url,
            `${process.env.APP_API_URL}/search/${query}/${pageNumber}/${itemsPerPage}`
        );
        assert.equal(mockGetCallArguments.headers['On-Behalf-Of'], '12-345678');
    });
});
