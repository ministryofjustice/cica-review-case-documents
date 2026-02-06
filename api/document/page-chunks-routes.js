import express from 'express';
import createPageChunksService from './services/page-chunks-service.js';

const CRN_REGEX = /^\d{2}-[78]\d{5}$/;

/**
 * Creates an Express router for handling page chunks operations via the API.
 * This router provides endpoints to retrieve page chunks with bounding boxes from OpenSearch.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createDocumentDAL] - Factory function for Document DAL (optional, for tests).
 * @param {Function} [options.createPageChunksService] - Factory function for page chunks service.
 * @returns {express.Router} The configured Express router for page chunks routes.
 *
 * @route GET /api/document/:documentId/page/:pageNumber/chunks
 */
function createPageChunksRouter(options = {}) {
    const {
        createDocumentDAL: createDocumentDALFactory,
        createPageChunksService: createPageChunksServiceFactory = createPageChunksService
    } = options;

    const router = express.Router();
    const pageChunksService = createPageChunksServiceFactory(
        createDocumentDALFactory ? { createDocumentDAL: createDocumentDALFactory } : {}
    );

    /**
     * GET /api/document/:documentId/page/:pageNumber/chunks
     *
     * Retrieves page chunks with bounding boxes from OpenSearch for rendering overlays.
     * Returns only the essential bounding box data needed for UI rendering.
     *
     * @param {express.Request} req - The Express request object.
     * @param {string} req.params.documentId - The UUID of the document.
     * @param {string} req.params.pageNumber - The page number to retrieve chunks for.
     * @param {string} req.query.crn - The case reference number (required).
     * @param {string} req.query.searchTerm - Search term to filter chunks by content.
     * @param {express.Response} res - The Express response object.
     *
     * @returns {Object} JSON response with page chunks:
     *   - chunks: Array of chunk objects with:
     *     - chunk_id: string - Unique identifier for the chunk
     *     - chunk_type: string - Type of chunk (LAYOUT_HEADER, etc.)
     *     - chunk_index: number - Index of the chunk on the page
     *     - bounding_box: Object - Bounding box coordinates
     *
     * @returns {Object} Error response:
     *   - errors: Array of error objects with status, title, and detail fields
     */
    router.get('/:documentId/page/:pageNumber/chunks', async (req, res, next) => {
        try {
            const { documentId, pageNumber } = req.params;
            const { crn, searchTerm } = req.query;

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

            const chunks = await pageChunksService.getPageChunks(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                { logger: req.log }
            );

            return res.json({
                data: {
                    type: 'page-chunks',
                    id: `${documentId}-${pageNumber}`,
                    attributes: {
                        chunks
                    }
                }
            });
        } catch (err) {
            return next(err);
        }
    });

    return router;
}

export default createPageChunksRouter;
