import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import createPageMetadataService from './page-metadata-service.js';

describe('page-metadata-service', () => {
    let mockLogger;
    let mockGetPageContent;
    let mockGetPageMetadata;
    let createPageContentHelper;
    let createDocumentDAL;

    const documentId = 'doc-123';
    const pageNumber = 2;
    const crn = '12-745678';

    beforeEach(() => {
        mockLogger = {
            info: () => {},
            error: () => {}
        };

        mockGetPageContent = async () => {
            return {
                source_doc_id: documentId,
                correspondence_type: 'TC19',
                page_count: 10,
                page_num: pageNumber,
                imageUrl: 's3://bucket/doc-123/2.png',
                text: 'Sample text'
            };
        };

        mockGetPageMetadata = async () => {
            return {
                correspondence_type: 'TC19'
            };
        };

        createPageContentHelper = () => {
            return {
                getPageContent: mockGetPageContent
            };
        };

        createDocumentDAL = () => {
            return {
                getPageMetadataByDocumentIdAndPageNumber: mockGetPageMetadata
            };
        };
    });

    it('should return combined metadata', async () => {
        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        const result = await service.getCombinedMetadata(documentId, pageNumber, crn, {
            logger: mockLogger
        });

        assert.deepStrictEqual(result, {
            documentId,
            correspondence_type: 'TC19',
            page_count: 10,
            page_num: 2,
            imageUrl: 's3://bucket/doc-123/2.png',
            text: 'Sample text'
        });
    });

    it('should pass documentId and pageNumber to page content helper', async () => {
        let capturedDocumentId;
        let capturedPageNumber;

        mockGetPageContent = async (docId, pageNum) => {
            capturedDocumentId = docId;
            capturedPageNumber = pageNum;
            return {
                correspondence_type: 'TC19',
                page_count: 10,
                page_num: pageNum,
                imageUrl: 's3://bucket/doc-123/2.png',
                text: 'Sample text'
            };
        };

        createPageContentHelper = () => ({
            getPageContent: mockGetPageContent
        });

        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        await service.getCombinedMetadata(documentId, pageNumber, crn, {
            logger: mockLogger
        });

        assert.strictEqual(capturedDocumentId, documentId);
        assert.strictEqual(capturedPageNumber, pageNumber);
    });

    it('should throw with status from OpenSearch error', async () => {
        const error = new Error('OpenSearch error');
        error.statusCode = 503;

        mockGetPageContent = async () => {
            throw error;
        };

        createPageContentHelper = () => ({
            getPageContent: mockGetPageContent
        });

        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        await assert.rejects(
            () => service.getCombinedMetadata(documentId, pageNumber, crn, { logger: mockLogger }),
            (err) => err.message === 'OpenSearch error' && err.status === 503
        );
    });

    it('should throw 404 when page metadata is missing', async () => {
        mockGetPageContent = async () => null;

        createPageContentHelper = () => ({
            getPageContent: mockGetPageContent
        });

        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        await assert.rejects(
            () => service.getCombinedMetadata(documentId, pageNumber, crn, { logger: mockLogger }),
            (err) => err.message === 'Page metadata not found' && err.status === 404
        );
    });

    it('should throw 500 when DAL fails', async () => {
        mockGetPageMetadata = async () => {
            throw new Error('DAL error');
        };

        createDocumentDAL = () => ({
            getPageMetadataByDocumentIdAndPageNumber: mockGetPageMetadata
        });

        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        await assert.rejects(
            () => service.getCombinedMetadata(documentId, pageNumber, crn, { logger: mockLogger }),
            (err) => err.message === 'DAL error' && err.status === 500
        );
    });

    it('should throw 404 when full metadata is missing', async () => {
        mockGetPageMetadata = async () => null;

        createDocumentDAL = () => ({
            getPageMetadataByDocumentIdAndPageNumber: mockGetPageMetadata
        });

        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        await assert.rejects(
            () => service.getCombinedMetadata(documentId, pageNumber, crn, { logger: mockLogger }),
            (err) => err.message === 'Page metadata not found' && err.status === 404
        );
    });

    it('should return a frozen object', () => {
        const service = createPageMetadataService({
            createPageContentHelper,
            createDocumentDAL
        });

        assert.strictEqual(Object.isFrozen(service), true);
        assert.strictEqual(typeof service.getCombinedMetadata, 'function');
    });
});
