import express from 'express';
import { validateDocumentParams } from '../middleware/validateDocumentParams/index.js';
import createDocumentMetadataService from './document-metadata-service.js';
import { createImageStreamingHandler } from './handlers/image-streaming.js';
import { createPageViewerHandler } from './handlers/page-viewer.js';
import { createTextViewerHandler } from './handlers/text-viewer.js';
import { createS3Client, validateS3Config } from './services/s3-service.js';

/**
 * Creates an Express router for handling document viewing functionality.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createDocumentMetadataService] - Factory function to create the document metadata service (for testing).
 * @returns {express.Router} The configured Express router for document routes.
 *
 * @route GET /document/:documentId/page/:pageNumber - Image streaming endpoint
 * @route GET /document/:documentId/view/page/:pageNumber - Page viewer endpoint
 * @route GET /document/:documentId/view/text/page/:pageNumber - Text viewer endpoint
 */
function createDocumentRouter(options = {}) {
    // Validate S3 configuration when router is created
    validateS3Config();

    const { createDocumentMetadataService: createMetadataService = createDocumentMetadataService } =
        options;
    const router = express.Router();

    // Create S3 client
    const s3Client = createS3Client();

    // IMAGE STREAMING ENDPOINT
    // GET /document/:documentId/page/:pageNumber
    router.get(
        '/:documentId/page/:pageNumber',
        validateDocumentParams(),
        createImageStreamingHandler(s3Client, createMetadataService)
    );

    // PAGE VIEWER ENDPOINT
    // GET /document/:documentId/view/page/:pageNumber
    router.get(
        '/:documentId/view/page/:pageNumber',
        validateDocumentParams(),
        createPageViewerHandler(createMetadataService)
    );

    // TEXT VIEWER ENDPOINT
    // GET /document/:documentId/view/text/page/:pageNumber
    router.get(
        '/:documentId/view/text/page/:pageNumber',
        validateDocumentParams(),
        createTextViewerHandler()
    );

    return router;
}

export default createDocumentRouter;
