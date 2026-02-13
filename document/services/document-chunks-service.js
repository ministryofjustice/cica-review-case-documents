import createRequestServiceDefault from '../../service/request/index.js';

/**
 * Creates a document chunks service for fetching bounding box data for document pages.
 * This service queries the API to get chunk bounding boxes for rendering overlays.
 *
 * @param {Object} options - The options for creating the document chunks service.
 * @param {string} options.documentId - The UUID of the document.
 * @param {number|string} options.pageNumber - The page number to fetch chunks for.
 * @param {string} options.crn - The case reference number.
 * @param {string} [options.searchTerm] - Search term to filter chunks by content.
 * @param {string} [options.jwtToken] - Optional JWT token for authentication.
 * @param {Object} options.logger - Logger instance for logging actions.
 * @param {Function} [options.createRequestService=createRequestServiceDefault] - Factory function to create a request service.
 * @returns {Object} The document chunks service with a method to fetch document chunks.
 */
function createPageChunksService({
    documentId,
    pageNumber,
    crn,
    searchTerm,
    jwtToken,
    logger,
    createRequestService = createRequestServiceDefault
} = {}) {
    const { get } = createRequestService();

    /**
     * Fetches document page chunks with bounding boxes from the API.
     * Returns only the bounding box data needed for overlay rendering.
     * Filters by search term to show only matching chunks.
     *
     * @async
     * @returns {Promise<Array<Object>>} A promise that resolves to an array of chunk objects with bounding boxes.
     */
    async function getPageChunks() {
        if (logger && typeof logger.info === 'function') {
            logger.info(
                { documentId, pageNumber, crn, searchTerm },
                'Fetching document page chunks with bounding boxes'
            );
        }

        // there's an issue with URLSearchParams encoding spaces to '+' which is breaking the api call. When encoded as %20 it works fine.
        const url = searchTerm
            ? `${process.env.APP_API_URL}/document/${documentId}/page/${pageNumber}/chunks?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}`
            : `${process.env.APP_API_URL}/document/${documentId}/page/${pageNumber}/chunks?crn=${encodeURIComponent(crn)}`;

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

        if (response?.body?.errors) {
            if (logger && typeof logger.error === 'function') {
                logger.error(
                    { errors: response.body.errors, documentId, pageNumber },
                    'Failed to fetch page chunks'
                );
            }
            throw new Error('Failed to fetch page chunks from API');
        }

        return response?.body?.data?.attributes?.chunks || [];
    }

    return Object.freeze({
        getPageChunks
    });
}

export default createPageChunksService;
