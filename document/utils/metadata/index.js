/**
 * Fetches metadata for a single document page.
 *
 * @param {object} options - Metadata fetch options.
 * @param {Function} options.createMetadataServiceFactory - Factory used to create a metadata service.
 * @param {string} options.documentId - Document identifier.
 * @param {number|string} options.pageNumber - Page number to fetch.
 * @param {string} options.crn - Case reference number.
 * @param {string} [options.jwtToken] - Optional JWT token from cookies.
 * @param {object} [options.logger] - Optional request logger.
 * @returns {Promise<object>} Page metadata from API.
 */
export async function fetchPageMetadata({
    createMetadataServiceFactory,
    documentId,
    pageNumber,
    crn,
    jwtToken,
    logger
}) {
    const metadataService = createMetadataServiceFactory({
        documentId,
        pageNumber,
        crn,
        jwtToken,
        logger
    });

    try {
        return await metadataService.getPageMetadata();
    } catch (error) {
        logger?.error(
            { error: error.message, documentId, pageNumber },
            'Failed to retrieve page metadata from API'
        );
        throw error;
    }
}
