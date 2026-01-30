import createPageContentHelperDefault from '../helpers/page-content-helper.js';
import createDocumentDALDefault from './document-dal.js';

/**
 * Creates a Page Metadata Service for combining OpenSearch metadata and document metadata.
 *
 * @param {Object} [options] - Optional configuration.
 * @param {Function} [options.createPageContentHelper] - Factory for page content helper.
 * @param {Function} [options.createDocumentDAL] - Factory for document DAL.
 * @returns {Object} Service with `getCombinedMetadata` method.
 */
function createPageMetadataService({
    createPageContentHelper: createPageContentHelperFactory = createPageContentHelperDefault,
    createDocumentDAL: createDocumentDALFactory = createDocumentDALDefault
} = {}) {
    /**
     * Fetch and combine page metadata from OpenSearch and document DAL.
     *
     * @async
     * @param {string} documentId - The UUID of the document.
     * @param {string|number} pageNumber - The page number.
     * @param {string} crn - The case reference number.
     * @param {Object} [context] - Context for the call.
     * @param {Object} [context.logger] - Logger instance.
     * @returns {Promise<Object>} Combined metadata payload.
     */
    async function getCombinedMetadata(documentId, pageNumber, crn, { logger } = {}) {
        const pageContentHelper = createPageContentHelperFactory({
            caseReferenceNumber: crn,
            logger
        });

        let pageMetadata;
        try {
            pageMetadata = await pageContentHelper.getPageContent(documentId, pageNumber);
        } catch (error) {
            logger?.error(
                { error: error.message, documentId, pageNumber },
                'Failed to retrieve page metadata from OpenSearch'
            );
            const err = new Error(error.message);
            err.status = error.status || error.statusCode || 500;
            throw err;
        }

        if (!pageMetadata) {
            const err = new Error('Page metadata not found');
            err.status = 404;
            throw err;
        }

        const dal = createDocumentDALFactory({
            caseReferenceNumber: crn,
            logger
        });

        let fullMetadata;
        try {
            fullMetadata = await dal.getPageMetadataByDocumentIdAndPageNumber(
                documentId,
                pageNumber
            );
        } catch (error) {
            logger?.error(
                { error: error.message, documentId, pageNumber },
                'Failed to retrieve full page metadata'
            );
            const err = new Error(error.message);
            err.status = 500;
            throw err;
        }

        if (!fullMetadata) {
            const err = new Error('Page metadata not found');
            err.status = 404;
            throw err;
        }

        return {
            correspondence_type: fullMetadata.correspondence_type || null,
            page_width: pageMetadata.page_width,
            page_height: pageMetadata.page_height,
            page_count: pageMetadata.page_count,
            imageUrl: pageMetadata.imageUrl,
            text: pageMetadata.text
        };
    }

    return Object.freeze({
        getCombinedMetadata
    });
}

export default createPageMetadataService;
