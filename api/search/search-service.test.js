import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';
import createSearchService from './search-service.js';

describe('Search Service', () => {
    let mockDAL;
    let mockDALFactory;

    beforeEach(() => {
        mockDAL = {
            getDocumentsChunksByKeyword: mock.fn()
        };

        mockDALFactory = mock.fn(() => mockDAL);
    });

    it('should create a search service instance', () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        assert.ok(searchService);
        assert.ok(typeof searchService.getSearchResultsByKeyword === 'function');
    });

    it('should return frozen object', () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        assert.throws(() => {
            searchService.newMethod = () => {};
        }, TypeError);
    });

    it('should call DAL factory with correct parameters', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => []);

        const caseReferenceNumber = '12-745678';
        const logger = { info: () => {} };

        await searchService.getSearchResultsByKeyword('test', 1, 10, {
            caseReferenceNumber,
            logger
        });

        assert.equal(mockDALFactory.mock.callCount(), 1);
        const [dalOptions] = mockDALFactory.mock.calls[0].arguments;
        assert.equal(dalOptions.caseReferenceNumber, caseReferenceNumber);
        assert.deepEqual(dalOptions.logger, logger);
    });

    it('should call getDocumentsChunksByKeyword with correct parameters', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => [
            { _id: '1', _source: { text: 'match' } }
        ]);

        const keyword = 'search term';
        const pageNumber = 2;
        const itemsPerPage = 20;

        await searchService.getSearchResultsByKeyword(keyword, pageNumber, itemsPerPage, {
            caseReferenceNumber: '12-745678',
            logger: { info: () => {} }
        });

        assert.equal(mockDAL.getDocumentsChunksByKeyword.mock.callCount(), 1);
        const args = mockDAL.getDocumentsChunksByKeyword.mock.calls[0].arguments;
        assert.deepEqual(args, [keyword, pageNumber, itemsPerPage]);
    });

    it('should return search results from DAL', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        const expectedResults = [
            { _id: '1', _source: { text: 'match 1' } },
            { _id: '2', _source: { text: 'match 2' } }
        ];

        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => expectedResults);

        const results = await searchService.getSearchResultsByKeyword('search', 1, 10, {
            caseReferenceNumber: '12-745678',
            logger: { info: () => {} }
        });

        assert.deepEqual(results, expectedResults);
    });

    it('should return empty array when no results found', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => []);

        const results = await searchService.getSearchResultsByKeyword('nonexistent', 1, 10, {
            caseReferenceNumber: '12-745678',
            logger: { info: () => {} }
        });

        assert.deepEqual(results, []);
    });

    it('should propagate DAL errors', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        const testError = new Error('Database error');
        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => {
            throw testError;
        });

        let caughtError;
        try {
            await searchService.getSearchResultsByKeyword('search', 1, 10, {
                caseReferenceNumber: '12-745678',
                logger: { info: () => {} }
            });
        } catch (err) {
            caughtError = err;
        }

        assert.equal(caughtError, testError);
    });

    it('should use default DAL factory when not provided', async () => {
        // Create a search service without providing a DAL factory
        // This will use the default factory which imports the real DAL
        // We can't easily test this with the real DAL, so we verify the service is created
        const searchService = createSearchService({});

        assert.ok(searchService);
        assert.ok(typeof searchService.getSearchResultsByKeyword === 'function');
    });

    it('should handle pagination across different pages', async () => {
        const searchService = createSearchService({
            createDocumentDAL: mockDALFactory
        });

        mockDAL.getDocumentsChunksByKeyword = mock.fn(async () => [
            { _id: 'page2_item1', _source: { text: 'result 1' } }
        ]);

        // Test page 3, 50 items per page
        await searchService.getSearchResultsByKeyword('test', 3, 50, {
            caseReferenceNumber: '12-745678',
            logger: { info: () => {} }
        });

        const args = mockDAL.getDocumentsChunksByKeyword.mock.calls[0].arguments;
        assert.deepEqual(args, ['test', 3, 50]);
    });
});
