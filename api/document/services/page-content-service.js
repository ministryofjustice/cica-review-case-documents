import createDocumentDALDefault from '../../DAL/document-dal.js';

/**
 * Creates a page content helper that retrieves page metadata and prepares content URLs/data.
 * This is document-specific logic for handling different content types from page metadata.
 *
 * @param {Object} options - Configuration options.
 * @param {string} options.caseReferenceNumber - The case reference number.
 * @param {Object} options.logger - Logger instance for logging actions.
 * @param {Function} [options.createDocumentDAL] - Factory function to create document DAL.
 * @returns {Object} Helper object with methods to retrieve page content.
 */
function createPageContentHelper({
    caseReferenceNumber,
    logger,
    createDocumentDAL = createDocumentDALDefault
}) {
    const documentDAL = createDocumentDAL({ caseReferenceNumber, logger });
    /**
     * Retrieves page metadata from OpenSearch and prepares response based on content type.
     *
     * @async
     * @param {string} documentId - The UUID of the document.
     * @param {number|string} pageNumber - The page number to retrieve.
     * @returns {Promise<Object>}
     * @throws {Error} If the page is not found or database query fails.
     */
    async function getPageContent(documentId, pageNumber) {
        try {
            logger.info({ documentId, pageNumber }, 'Retrieving page content');

            // Query OpenSearch for page metadata using DAL
            const pageMetadata = await documentDAL.getPageMetadataByDocumentIdAndPageNumber(
                documentId,
                pageNumber
            );

            if (!pageMetadata) {
                const error = new Error('Page not found in OpenSearch');
                error.status = 404;
                throw error;
            }

            // Prepare response based on content type
            return {
                correspondence_type: pageMetadata.correspondence_type,
                page_count: pageMetadata.page_count,
                page_num: pageMetadata.page_num,
                imageUrl: pageMetadata.s3_page_image_s3_uri,
                text: pageMetadata.text
            };
        } catch (error) {
            logger.error(
                { error: error.message, documentId, pageNumber },
                'Failed to retrieve page content'
            );
            throw error;
        }
    }

    return Object.freeze({
        getPageContent
    });
}

export default createPageContentHelper;
