import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';
import createDocumentMetadataService from './document-metadata-service.js';

// S3 bucket location
const S3_BUCKET_LOCATION = process.env.APP_S3_BUCKET_LOCATION;
// API base URL for fetching metadata from OpenSearch
const API_BASE_URL = process.env.APP_API_URL;

if (!API_BASE_URL || !S3_BUCKET_LOCATION) {
    throw new Error(
        'Missing required environment variables APP_API_URL and/or APP_S3_BUCKET_LOCATION'
    );
}

const isLocal = process.env.APP_S3_BUCKET_LOCATION?.includes('localhost');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-west-2',
    ...(isLocal
        ? {
              endpoint: process.env.APP_S3_BUCKET_LOCATION,
              forcePathStyle: true,
              credentials: {
                  accessKeyId: process.env.CICA_AWS_ACCESS_KEY_ID || 'test',
                  secretAccessKey: process.env.CICA_AWS_SECRET_ACCESS_KEY || 'test'
              }
          }
        : {
              // In AWS, use IRSA: do not set endpoint or credentials
          })
});

const toSentenceCaseAfterDash = (str) => {
    const [prefix, rest] = str.split(' - ');
    return rest ? `${prefix} - ${rest.toLowerCase().replace(/^./, (c) => c.toUpperCase())}` : str;
};

/**
 * Creates an Express router for handling document viewing functionality.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createDocumentMetadataService] - Factory function to create the document metadata service (for testing).
 * @returns {express.Router} The configured Express router for document routes.
 *
 * @route GET /document/:documentId/view/page/:pageNumber
 * @route GET /document/:documentId/page/:pageNumber
 */
function createDocumentRouter(options = {}) {
    const { createDocumentMetadataService: createMetadataService = createDocumentMetadataService } =
        options;
    const router = express.Router();

    /**
     * IMAGE STREAMING ENDPOINT
     * GET /document/:documentId/page/:pageNumber
     * Streams the document page image directly from S3 bucket
     *
     * Fetches page metadata from the API to retrieve the S3 URI,
     * then streams the image directly from S3.
     *
     * @param {express.Request} req - The Express request object.
     * @param {string} req.params.documentId - The UUID of the document.
     * @param {string} req.params.pageNumber - The page number to stream.
     * @param {string} req.query.crn - The case reference number (passed as query parameter).
     * @param {express.Response} res - The Express response object.
     */
    router.get('/:documentId/page/:pageNumber', async (req, res) => {
        try {
            const { documentId, pageNumber } = req.params;
            const { crn } = req.query;

            // Validate inputs to prevent SSRF attacks
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(documentId)) {
                req.log?.warn({ documentId }, 'Invalid document ID format in image streaming');
                return res.status(400).json({
                    errors: [
                        { status: 400, title: 'Bad Request', detail: 'Invalid document ID format' }
                    ]
                });
            }

            const pageNum = parseInt(pageNumber, 10);
            if (!Number.isInteger(pageNum) || pageNum < 1) {
                req.log?.warn({ pageNumber }, 'Invalid page number in image streaming');
                return res.status(400).json({
                    errors: [{ status: 400, title: 'Bad Request', detail: 'Invalid page number' }]
                });
            }

            // Validate CRN format
            const crnRegex = /^[a-zA-Z0-9\-\s]+$/;
            if (!crn || !crnRegex.test(crn)) {
                req.log?.warn({ crn }, 'Invalid case reference number format in image streaming');
                return res.status(400).json({
                    errors: [
                        {
                            status: 400,
                            title: 'Bad Request',
                            detail: 'Invalid case reference number'
                        }
                    ]
                });
            }

            // Fetch metadata from API to get the S3 URI
            let pageMetadata;
            try {
                const metadataService = createMetadataService({
                    documentId,
                    pageNumber: pageNum,
                    crn,
                    jwtToken: req.cookies?.jwtToken,
                    logger: req.log
                });
                pageMetadata = await metadataService.getPageMetadata();
            } catch (error) {
                req.log?.warn(
                    { error: error.message, documentId, pageNumber, crn },
                    'Failed to retrieve page metadata for image streaming'
                );
                return res.status(204).end();
            }

            if (!pageMetadata.imageUrl) {
                req.log?.warn(
                    { documentId, pageNumber, crn },
                    'S3 URI not found in metadata for image streaming'
                );
                return res.status(204).end();
            }

            // Parse S3 URI to get bucket and object key
            const s3PathParts = pageMetadata.imageUrl.replace('s3://', '').split('/');
            const bucketName = s3PathParts.shift();
            const objectKey = s3PathParts.join('/');

            try {
                const command = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey
                });

                // Get the content from S3
                const { Body, ContentType, ContentLength } = await s3Client.send(command);

                res.set('Content-Type', ContentType || 'image/png');
                if (ContentLength) {
                    res.set('Content-Length', ContentLength);
                }

                // Stream the image to the browser
                Body.pipe(res);
            } catch (err) {
                // Handle S3 errors gracefully
                const errorName = err.name || err.Code || '';
                const errorMessage = err.message || '';

                // Return 204 No Content for missing images or access issues
                // This allows the UI to handle missing images gracefully
                if (
                    errorName === 'NoSuchKey' ||
                    errorName === 'NotFound' ||
                    errorMessage.includes('does not exist')
                ) {
                    req.log?.info({ documentId, pageNumber, crn }, 'Image not found in S3');
                    return res.status(204).end();
                }

                // For other S3 errors (credentials, network, etc.), also return 204
                // to prevent cascading failures
                req.log?.warn(
                    { error: err.message, documentId, pageNumber },
                    'S3 error when streaming image'
                );
                return res.status(204).end();
            }
        } catch (err) {
            req.log?.error({ error: err.message }, 'Error in image streaming endpoint');
            res.status(500).json({
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

    /**
     * PAGE VIEWER ENDPOINT
     * GET /document/:documentId/view/page/:pageNumber
     *
     * Renders a page view with an image from the associated document.
     * The documentId should be a valid UUID and pageNumber should be a positive integer.
     *
     * @param {express.Request} req - The Express request object.
     * @param {string} req.params.documentId - The UUID of the document to view.
     * @param {string} req.params.pageNumber - The page number to display.
     * @param {string} req.query.crn - The case reference number (passed as query parameter).
     * @param {express.Response} res - The Express response object.
     * @param {Function} next - The next middleware function.
     */
    router.get('/:documentId/view/page/:pageNumber', async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            const { documentId, pageNumber } = req.params;

            const { crn, searchResultsPageNumber = '', searchTerm = '' } = req.query;
            const pageNum = parseInt(pageNumber, 10);

            // Validate inputs to prevent SSRF attacks
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(documentId)) {
                const error = new Error('Invalid document ID format');
                error.status = 400;
                return next(error);
            }

            if (!Number.isInteger(pageNum) || pageNum < 1) {
                const error = new Error('Invalid page number');
                error.status = 400;
                return next(error);
            }

            // Validate CRN format
            const crnRegex = /^[a-zA-Z0-9\-\s]+$/;
            if (!crn || !crnRegex.test(crn)) {
                const error = new Error('Invalid case reference number format');
                error.status = 400;
                return next(error);
            }

            // Fetch document page metadata from API (which queries OpenSearch)
            let pageMetadata;
            try {
                const metadataService = createMetadataService({
                    documentId,
                    pageNumber: pageNum,
                    crn,
                    jwtToken: req.cookies?.jwtToken,
                    logger: req.log
                });
                pageMetadata = await metadataService.getPageMetadata();
            } catch (error) {
                req.log?.error(
                    { error: error.message, documentId, pageNum },
                    'Failed to retrieve page metadata from API'
                );
                return next(error);
            }

            const imageUrl = `/document/${documentId}/page/${pageNumber}?crn=${crn}`;

            const textPageLink = `/document/${documentId}/view/text/page/${pageNum}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&searchResultsPageNumber=${searchResultsPageNumber}`;
            const backLink =
                searchTerm === ''
                    ? '/search'
                    : `/search?query=${encodeURIComponent(searchTerm)}&pageNumber=${searchResultsPageNumber}&crn=${encodeURIComponent(crn)}`;

            // Use correspondence_type from metadata as page title, with fallback
            const pageTitle = pageMetadata.correspondence_type
                ? toSentenceCaseAfterDash(pageMetadata.correspondence_type)
                : 'Document image';

            const html = render('document/page/imageview.njk', {
                documentId,
                pageNumber: pageNum,
                imageUrl,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                textPageLink,
                backLink,
                pageTitle
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    });

    /**
     * PLACEHOLDER TEXT VIEWER ENDPOINT
     * GET /document/:documentId/view/text/page/:pageNumber
     *
     * Renders a placeholder text view page with navigation back to image view.
     * The documentId should be a valid UUID and pageNumber should be a positive integer.
     *
     * @param {express.Request} req - The Express request object.
     * @param {string} req.params.documentId - The UUID of the document to view.
     * @param {string} req.params.pageNumber - The page number to display.
     * @param {string} req.query.crn - The case reference number (passed as query parameter).
     * @param {express.Response} res - The Express response object.
     * @param {Function} next - The next middleware function.
     */
    router.get('/:documentId/view/text/page/:pageNumber', async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            const { documentId, pageNumber } = req.params;
            const { crn, searchResultsPageNumber = '1', searchTerm = '' } = req.query;
            const pageNum = parseInt(pageNumber, 10);

            // Validate inputs to prevent SSRF attacks
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(documentId)) {
                const error = new Error('Invalid document ID format');
                error.status = 400;
                return next(error);
            }

            if (!Number.isInteger(pageNum) || pageNum < 1) {
                const error = new Error('Invalid page number');
                error.status = 400;
                return next(error);
            }

            // Validate CRN format
            const crnRegex = /^[a-zA-Z0-9\-\s]+$/;
            if (!crn || !crnRegex.test(crn)) {
                const error = new Error('Invalid case reference number format');
                error.status = 400;
                return next(error);
            }

            const imagePageLink = `/document/${documentId}/view/page/${pageNum}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&searchResultsPageNumber=${searchResultsPageNumber}`;
            const backLink =
                searchTerm === ''
                    ? '/search'
                    : `/search?query=${encodeURIComponent(searchTerm)}&pageNumber=${searchResultsPageNumber}&crn=${encodeURIComponent(crn)}`;

            const html = render('document/page/textview.njk', {
                documentId,
                pageNumber: pageNum,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                imagePageLink,
                backLink
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    });

    return router;
}

export default createDocumentRouter;
