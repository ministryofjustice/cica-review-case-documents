import express from 'express';
import createPageContentHelper from '../helpers/page-content-helper.js';

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
        createDocumentDAL: createDocumentDALFactory
    } = options;

    const router = express.Router();

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
     *   - page_width: number - Page width in pixels
     *   - page_height: number - Page height in pixels
     *   - page_count: number - Total pages in document
     *
     * @returns {Object} Error response:
     *   - errors: Array of error objects with status, title, and detail fields
     */
    router.get('/:documentId/page/:pageNumber/metadata', async (req, res) => {
        try {
            const { documentId, pageNumber } = req.params;
            const { crn } = req.query;

            if (!crn) {
                return res.status(400).json({
                    errors: [
                        {
                            status: 400,
                            title: 'Bad Request',
                            detail: 'Case reference number (crn) is required'
                        }
                    ]
                });
            }

            // Create page content helper with database access
            const pageContentHelper = createPageContentHelperFactory({
                caseReferenceNumber: crn,
                logger: req.log
            });

            // Retrieve page metadata from OpenSearch
            let pageMetadata;
            try {
                pageMetadata = await pageContentHelper.getPageContent(documentId, pageNumber);

                if (!pageMetadata) {
                    return res.status(404).json({
                        errors: [
                            {
                                status: 404,
                                title: 'Not Found',
                                detail: 'Page metadata not found'
                            }
                        ]
                    });
                }
            } catch (dbError) {
                req.log?.error(
                    { error: dbError.message, documentId, pageNumber },
                    'Failed to retrieve page metadata from OpenSearch'
                );
                const status = dbError.status || 500;
                return res.status(status).json({
                    errors: [
                        {
                            status,
                            title: status === 404 ? 'Not Found' : 'Internal Server Error',
                            detail: dbError.message
                        }
                    ]
                });
            }

            let fullMetadata;
            try {
                // Use injected DAL factory when provided (tests), else dynamically import default
                const createDocumentDAL = createDocumentDALFactory
                    ? createDocumentDALFactory
                    : (await import('./document-dal.js')).default;
                const dal = createDocumentDAL({
                    caseReferenceNumber: crn,
                    logger: req.log
                });

                fullMetadata = await dal.getPageMetadataByDocumentIdAndPageNumber(
                    documentId,
                    pageNumber
                );

                if (!fullMetadata) {
                    return res.status(404).json({
                        errors: [
                            {
                                status: 404,
                                title: 'Not Found',
                                detail: 'Page metadata not found'
                            }
                        ]
                    });
                }
            } catch (error) {
                req.log?.error(
                    { error: error.message, documentId, pageNumber },
                    'Failed to retrieve full page metadata'
                );
                return res.status(500).json({
                    errors: [
                        {
                            status: 500,
                            title: 'Internal Server Error',
                            detail: error.message
                        }
                    ]
                });
            }

            // Return combined metadata
            return res.json({
                data: {
                    correspondence_type: fullMetadata.correspondence_type || null,
                    page_width: pageMetadata.page_width,
                    page_height: pageMetadata.page_height,
                    page_count: pageMetadata.page_count,
                    imageUrl: pageMetadata.imageUrl,
                    text: pageMetadata.text
                }
            });
        } catch (err) {
            req.log?.error({ error: err.message }, 'Error in page metadata endpoint');
            return res.status(500).json({
                errors: [
                    {
                        status: 500,
                        title: 'Internal Server Error',
                        detail: err.message
                    }
                ]
            });
        }
    });

    return router;
}

export default createPageMetadataRouter;
