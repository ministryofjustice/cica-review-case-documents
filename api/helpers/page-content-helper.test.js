import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import createPageContentHelper from './page-content-helper.js';

describe('Page Content Helper', () => {
    let mockDocumentDAL;
    let mockLogger;
    let pageContentHelper;

    beforeEach(() => {
        // Mock logger
        mockLogger = {
            info: mock.fn(),
            error: mock.fn()
        };

        // Mock document DAL
        mockDocumentDAL = {
            getPageMetadataByDocumentIdAndPageNumber: mock.fn(async () => ({
                source_doc_id: 'doc-123',
                page_num: 5,
                s3_page_image_s3_uri: 's3://my-bucket/path/to/image.png',
                page_width: 800,
                page_height: 1200,
                page_count: 10,
                text: 'Sample page text content'
            }))
        };

        // Create helper instance
        pageContentHelper = createPageContentHelper({
            caseReferenceNumber: '12-345678',
            logger: mockLogger,
            createDocumentDAL: () => mockDocumentDAL
        });
    });

    describe('getPageContent', () => {
        it('should call documentDAL with correct parameters', async () => {
            await pageContentHelper.getPageContent('doc-456', 3);

            assert.strictEqual(mockDocumentDAL.getPageMetadataByDocumentIdAndPageNumber.mock.callCount(), 1);
            const args = mockDocumentDAL.getPageMetadataByDocumentIdAndPageNumber.mock.calls[0].arguments;
            assert.strictEqual(args[0], 'doc-456');
            assert.strictEqual(args[1], 3);
        });

        it('should throw 404 error when page not found', async () => {
            mockDocumentDAL.getPageMetadataByDocumentIdAndPageNumber = mock.fn(async () => null);
            
            const helper = createPageContentHelper({
                caseReferenceNumber: '12-345678',
                logger: mockLogger,
                createDocumentDAL: () => mockDocumentDAL
            });

            await assert.rejects(
                async () => helper.getPageContent('doc-123', 999),
                {
                    message: 'Page not found in OpenSearch',
                    status: 404
                }
            );

            assert.strictEqual(mockLogger.error.mock.callCount(), 1);
        });
    });


    describe('Error handling', () => {
        it('should propagate DAL errors', async () => {
            mockDocumentDAL.getPageMetadataByDocumentIdAndPageNumber = mock.fn(async () => {
                throw new Error('Database connection failed');
            });

            const helper = createPageContentHelper({
                caseReferenceNumber: '12-345678',
                logger: mockLogger,
                createDocumentDAL: () => mockDocumentDAL
            });

            await assert.rejects(
                async () => helper.getPageContent('doc-123', 1),
                { message: 'Database connection failed' }
            );

            assert.strictEqual(mockLogger.error.mock.callCount(), 1);
        });

        it('should handle string page numbers', async () => {
            const result = await pageContentHelper.getPageContent('doc-123', '5');

            assert.ok(result);
            const args = mockDocumentDAL.getPageMetadataByDocumentIdAndPageNumber.mock.calls[0].arguments;
            assert.strictEqual(args[1], '5');
        });
    });
});
