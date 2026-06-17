import createRequestServiceDefault from '../../service/request/index.js';

const CRN_REGEX = /^\d{2}-[78]\d{5}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateDocumentId(documentId) {
    if (!UUID_REGEX.test(documentId)) {
        throw new Error('Invalid document ID format');
    }
}

function normalizePageNumber(pageNumber) {
    const pageNum = Number(pageNumber);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
        throw new Error('Invalid page number');
    }

    return pageNum;
}

function validateCrn(crn) {
    if (!crn || !CRN_REGEX.test(crn)) {
        throw new Error('Invalid case reference number format');
    }
}

function getApiBaseUrl() {
    const apiBaseUrl = process.env.APP_API_URL;
    if (!apiBaseUrl) {
        throw new Error('APP_API_URL environment variable is not set');
    }

    return apiBaseUrl;
}

function toRequestOptions(url, jwtToken) {
    if (!jwtToken) {
        return { url };
    }

    return {
        url,
        headers: {
            Authorization: `Bearer ${jwtToken}`
        }
    };
}

function extractMetadataOrThrow(response) {
    if (!response.body) {
        throw new Error('No response body received from API');
    }

    if (response.body.errors) {
        const error = new Error(response.body.errors[0]?.detail || 'Failed to fetch page metadata');
        error.status = response.statusCode || 500;
        throw error;
    }

    return response.body.data;
}

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
     * @returns {Promise<Object>} Resolves with valid page metadata object.
     * @throws {Error} If input validation fails, API is unreachable, or response is malformed.
     */
    async function getPageMetadata() {
        validateDocumentId(documentId);
        const pageNum = normalizePageNumber(pageNumber);
        validateCrn(crn);
        const apiBaseUrl = getApiBaseUrl();

        if (logger) {
            logger.info({ documentId, pageNumber: pageNum, crn }, 'Fetching page metadata');
        }

        // Construct URL with validated inputs
        const url = `${apiBaseUrl}/document/${documentId}/page/${pageNum}/metadata?crn=${encodeURIComponent(crn)}`;

        const opts = toRequestOptions(url, jwtToken);

        const response = await get(opts);

        return extractMetadataOrThrow(response);
    }

    return Object.freeze({
        getPageMetadata
    });
}

export default createDocumentMetadataService;
