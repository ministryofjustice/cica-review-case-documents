import createDocumentDALDefault from '../../DAL/document-dal.js';
import createPageContentHelperDefault from './page-content-service.js';

/**
 * Parses and validates page number values consistently for querying and response payloads.
 *
 * @param {number} pageNumber - Parsed page number input.
 * @returns {number} Validated page number as a positive integer.
 * @throws {Error} If page number is not a positive integer.
 */
function parsePageNumber(pageNumber) {
    if (typeof pageNumber !== 'number' || !Number.isInteger(pageNumber) || pageNumber < 1) {
        const err = new Error('Invalid page number');
        err.status = 400;
        throw err;
    }

    return pageNumber;
}

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
     * @param {number} pageNumber - The page number.
     * @param {string} crn - The case reference number.
     * @param {Object} [context] - Context for the call.
     * @param {Object} [context.logger] - Logger instance.
     * @returns {Promise<Object>} Combined metadata payload.
     */
    async function getCombinedMetadata(documentId, pageNumber, crn, { logger } = {}) {
        const requestedPageNumber = parsePageNumber(pageNumber);

        const pageContentHelper = createPageContentHelperFactory({
            caseReferenceNumber: crn,
            logger
        });

        let pageMetadata;
        try {
            pageMetadata = await pageContentHelper.getPageContent(documentId, requestedPageNumber);
        } catch (error) {
            logger?.error(
                { error: error.message, documentId, pageNumber: requestedPageNumber },
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
                requestedPageNumber
            );
        } catch (error) {
            logger?.error(
                { error: error.message, documentId, pageNumber: requestedPageNumber },
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

        const metadataPageNumber = parsePageNumber(pageMetadata.page_num);

        return {
            correspondence_type: fullMetadata.correspondence_type || null,
            page_count: pageMetadata.page_count,
            page_num: metadataPageNumber,
            imageUrl: pageMetadata.imageUrl,
            text: pageMetadata.text
        };
    }

    return Object.freeze({
        getCombinedMetadata
    });
}

export default createPageMetadataService;
