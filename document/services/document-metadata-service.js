import createRequestServiceDefault from '../../service/request/index.js';

const CRN_REGEX = /^\d{2}-[78]\d{5}$/;

/**
 * Creates a document metadata service for fetching page metadata from the API.
 *
 * @param {Object} options - The options for creating the metadata service.
 * @param {string} options.documentId - The UUID of the document
 * @param {number} options.pageNumber - The page number
 * @param {string} options.crn - The case reference number (format: YY-7NNNNN or YY-8NNNNN, e.g. 26-711111)
 * @param {string} [options.jwtToken] - Optional JWT token for authentication
 * @param {Object} [options.logger] - Optional logger instance
 * @param {Function} [options.createRequestService] - Factory function to create request service (for testing)
 * @returns {Object} The metadata service with a method to fetch page metadata
 */
function createDocumentMetadataService({
    documentId,
    pageNumber,
    crn,
    jwtToken,
    logger,
    createRequestService = createRequestServiceDefault
} = {}) {
    const { get } = createRequestService();

    /**
     * Fetches page metadata from the API.
     *
     * @async
     * @returns {Promise<Object>} A promise that resolves to the page metadata
     * @throws {Error} If the API request fails or returns an error
     */
    async function getPageMetadata() {
        // Validate inputs before constructing URL (defense in depth)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(documentId)) {
            throw new Error('Invalid document ID format');
        }

        const pageNum = Number(pageNumber);
        if (!Number.isInteger(pageNum) || pageNum < 1) {
            throw new Error('Invalid page number');
        }

        // Validate CRN format (case reference number)
        // Format: YY-7NNNNN or YY-8NNNNN (e.g. 26-711111, 36-873423)
        // where YY = year, 7 = Personal Injury, 8 = Bereavement, NNNNN = 5-digit case ID
        if (!crn || !CRN_REGEX.test(crn)) {
            throw new Error('Invalid case reference number format');
        }

        // Get API base URL from environment (trusted configuration)
        const apiBaseUrl = process.env.APP_API_URL;
        if (!apiBaseUrl) {
            throw new Error('APP_API_URL environment variable is not set');
        }

        if (logger) {
            logger.info({ documentId, pageNumber: pageNum, crn }, 'Fetching page metadata');
        }

        // Construct URL with validated inputs
        const url = `${apiBaseUrl}/document/${documentId}/page/${pageNum}/metadata?crn=${encodeURIComponent(crn)}`;

        const opts = {
            url
        };

        if (jwtToken) {
            // Only include Authorization header if jwtToken is provided, do not send undefined or empty token
            opts.headers = {
                Authorization: `Bearer ${jwtToken}`
            };
        }

        const response = await get(opts);

        if (!response.body) {
            throw new Error('No response body received from API');
        }

        if (response.body.errors) {
            const error = new Error(
                response.body.errors[0]?.detail || 'Failed to fetch page metadata'
            );
            error.status = response.statusCode || 500;
            throw error;
        }

        return response.body.data;
    }

    return Object.freeze({
        getPageMetadata
    });
}

export default createDocumentMetadataService;
