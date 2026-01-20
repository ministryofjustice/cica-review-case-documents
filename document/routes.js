import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';


// S3 bucket location
const S3_BUCKET_LOCATION = process.env.APP_S3_BUCKET_LOCATION;
// API base URL for fetching metadata from OpenSearch
const API_BASE_URL = process.env.APP_API_URL;

if (!API_BASE_URL || !S3_BUCKET_LOCATION) {
    throw new Error('Missing required environment variables APP_API_URL and/or APP_S3_BUCKET_LOCATION');
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
        }
    )
});

const toSentenceCaseAfterDash = (str) => {
    const [prefix, rest] = str.split(" - ");
    return rest
        ? `${prefix} - ${rest.toLowerCase().replace(/^./, c => c.toUpperCase())}`
        : str;
}

/**
 * Creates an Express router for handling document viewing functionality.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createDocumentService] - Factory function to create the document service.
 * @returns {express.Router} The configured Express router for document routes.
 *
 * @route GET /document/:documentId/view/page/:pageNumber
 * @route GET /document/:documentId/page/:pageNumber
 */
function createDocumentRouter() {
    const router = express.Router();

    /**
     * IMAGE STREAMING ENDPOINT
     * GET /document/:documentId/page/:pageNumber
     * Streams the document page image directly from S3 bucket
     * 
     * Uses the S3 URI stored in session by the view/page route (from OpenSearch).
     * Falls back to constructing path from pattern if session data unavailable.
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

            // Try to get S3 URI from session (set by view/page route)
            const pageKey = `${documentId}-${pageNumber}`;
            const s3Uri = req.session?.pageS3Uris?.[pageKey];

            let bucketName;
            let objectKey;

            if (s3Uri) {
                // Use S3 URI from OpenSearch (via API)
                const s3PathParts = s3Uri.replace('s3://', '').split('/');
                bucketName = s3PathParts.shift();
                objectKey = s3PathParts.join('/');
            } else {
                // We don't have the S3 URI in session so we need to fail with 204 No Content
                req.log?.warn({ documentId, pageNumber, crn }, 'S3 URI not found in session for image streaming');
                return res.status(204).end();
            }

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
                if (errorName === 'NoSuchKey' || errorName === 'NotFound' || errorMessage.includes('does not exist')) {
                    req.log?.info({ documentId, pageNumber, crn }, 'Image not found in S3');
                    return res.status(204).end();
                }

                // For other S3 errors (credentials, network, etc.), also return 204
                // to prevent cascading failures
                req.log?.warn({ error: err.message, documentId, pageNumber }, 'S3 error when streaming image');
                return res.status(204).end();
            }

        } catch (err) {
            req.log?.error({ error: err.message }, 'Error in image streaming endpoint');
            res.status(500).json({
                errors: [{
                    status: 500,
                    title: 'Internal Server Error',
                    detail: err.message
                }]
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

            const { crn, searchPageNumber } = req.query;
            const pageNum = parseInt(pageNumber, 10);

            const { searchTerm = '', searchResultsPageNumber = searchPageNumber || 1 } = req.session

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

            // Fetch document page metadata from API (which queries OpenSearch)
            let pageMetadata;
            try {
                const apiUrl = `${API_BASE_URL}/document/${documentId}/page/${pageNum}/metadata?crn=${encodeURIComponent(crn)}`;

                // Validate that the constructed URL belongs to the expected API base URL origin
                const apiUrlObj = new URL(apiUrl);
                const baseUrlObj = new URL(API_BASE_URL);

                // Ensure the request goes to the same origin as the configured API base URL
                if (apiUrlObj.origin !== baseUrlObj.origin) {
                    throw new Error('Invalid API URL - origin mismatch');
                }

                // Forward the JWT token to the API for authentication
                const headers = {};
                if (req.cookies?.jwtToken) {
                    headers.Authorization = `Bearer ${req.cookies.jwtToken}`;
                }

                // Get metadata
                const response = await fetch(apiUrl, { headers });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }));
                    const error = new Error(errorData.errors?.[0]?.detail || 'Failed to fetch page metadata');
                    error.status = response.status;
                    throw error;
                }

                const result = await response.json();
                pageMetadata = result.data;

                // Store S3 URI in session for image streaming route to use                
                if (!req.session.pageS3Uris) {
                    req.session.pageS3Uris = {};
                }
                const pageKey = `${documentId}-${pageNum}`;
                req.session.pageS3Uris[pageKey] = pageMetadata.imageUrl;
            } catch (error) {
                req.log?.error({ error: error.message, documentId, pageNum }, 'Failed to retrieve page metadata from API');
                return next(error);
            }

            const imageUrl = `/document/${documentId}/page/${pageNumber}?crn=${crn}`

            const textPageLink = `/document/${documentId}/view/text/page/${pageNum}?crn=${encodeURIComponent(crn)}&searchPageNumber=${searchPageNumber || searchResultsPageNumber}`;
            const backLink = searchTerm === '' ? '/search' : `/search?query=${searchTerm}&pageNumber=${searchPageNumber || searchResultsPageNumber}&crn=${encodeURIComponent(crn)}`

            // Use correspondence_type from metadata as page title, with fallback
            const pageTitle = pageMetadata.correspondence_type ? toSentenceCaseAfterDash(pageMetadata.correspondence_type) : 'Document image';

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
            const { crn, searchPageNumber } = req.query;
            const pageNum = parseInt(pageNumber, 10);

            const { searchTerm = '', searchResultsPageNumber = searchPageNumber || 1 } = req.session;

            const imagePageLink = `/document/${documentId}/view/page/${pageNum}?crn=${encodeURIComponent(crn)}&searchPageNumber=${searchPageNumber || searchResultsPageNumber}`;
            const backLink = searchTerm === '' ? '/search' : `/search?query=${searchTerm}&pageNumber=${searchPageNumber || searchResultsPageNumber}&crn=${encodeURIComponent(crn)}`;

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
