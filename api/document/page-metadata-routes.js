import express from 'express';
import createPageContentHelper from './services/page-content-service.js';
import createPageMetadataService from './services/page-metadata-service.js';

export const CRN_REGEX = /^\d{2}-[78]\d{5}$/;
export const PAGE_NUMBER_REGEX = /^\d+$/;

/**
 * Creates an Express router for handling page metadata operations via the API.
 * This router provides endpoints to retrieve page metadata from OpenSearch.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createPageContentHelper] - Factory function to create the page content helper.
 * @returns {express.Router} The configured Express router for page metadata routes.
 *
 * @route GET /api/document/:documentId/page/:pageNumber/metadata
 */
function createPageMetadataRouter(options = {}) {
    const {
        createPageContentHelper: createPageContentHelperFactory = createPageContentHelper,
        // Optional dependency injection for tests: provide a factory for the Document DAL
        createDocumentDAL: createDocumentDALFactory,
        createPageMetadataService: createPageMetadataServiceFactory = createPageMetadataService
    } = options;

    const router = express.Router();
    const pageMetadataService = createPageMetadataServiceFactory({
        createPageContentHelper: createPageContentHelperFactory,
        createDocumentDAL: createDocumentDALFactory
    });

    /**
     * GET /api/document/:documentId/page/:pageNumber/metadata
     *
     * Retrieves page metadata from OpenSearch including correspondence_type, dimensions, and S3 URI.
     * This endpoint is called by the main app to get document page information.
     *
     * @param {express.Request} req - The Express request object.
     * @param {string} req.params.documentId - The UUID of the document.
     * @param {string} req.params.pageNumber - The page number to retrieve metadata for.
     * @param {string} req.query.crn - The case reference number (required).
     * @param {express.Response} res - The Express response object.
     *
     * @returns {Object} JSON response with page metadata:
     *   - correspondence_type: string - Type of correspondence (used as page title)
     *   - page_count: number - Total pages in document
     *   - page_num: number - Current page number
     *   - imageUrl: string - S3 URI for the page image
     *   - text: string - Extracted text content for the page (if available)
     *
     * @returns {Object} Error response:
     *   - errors: Array of error objects with status, title, and detail fields
     */
    router.get('/:documentId/page/:pageNumber/metadata', async (req, res, next) => {
        try {
            const { documentId, pageNumber } = req.params;
            const { crn } = req.query;

            if (!crn) {
                const err = new Error('Case reference number (crn) is required');
                err.status = 400;
                throw err;
            }

            if (!CRN_REGEX.test(crn)) {
                const err = new Error('Invalid case reference number');
                err.status = 400;
                throw err;
            }

            if (!PAGE_NUMBER_REGEX.test(pageNumber) || Number.parseInt(pageNumber, 10) < 1) {
                const err = new Error('Invalid page number');
                err.status = 400;
                throw err;
            }

            const parsedPageNumber = Number.parseInt(pageNumber, 10);

            const combinedMetadata = await pageMetadataService.getCombinedMetadata(
                documentId,
                parsedPageNumber,
                crn,
                { logger: req.log }
            );

            return res.json({ data: combinedMetadata });
        } catch (err) {
            return next(err);
        }
    });

    return router;
}

export default createPageMetadataRouter;
