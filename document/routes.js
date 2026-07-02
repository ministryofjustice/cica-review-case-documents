import express from 'express';
import { validateDocumentParams } from '../middleware/validateDocumentParams/index.js';
import createSavedSearchStoreDefault from '../search/saved-search-store.js';
import { createImageStreamingHandler } from './handlers/image-streaming.js';
import { createPageViewerHandler } from './handlers/page-viewer.js';
import { createTextViewerHandler } from './handlers/text-viewer.js';
import createPageChunksService from './services/document-chunks-service.js';
import createDocumentMetadataService from './services/document-metadata-service.js';
import { createS3Client } from './services/s3-service.js';

/**
 * Creates an Express router for handling document viewing functionality.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createDocumentMetadataService] - Factory function to create the document metadata service (for testing).
 * @param {Function} [options.createPageChunksService] - Factory function to create the page chunks service (for testing).
 * @param {Function} [options.createSavedSearchStore] - Factory function to create saved-search store (for testing).
 * @returns {express.Router} The configured Express router for document routes.
 *
 * @route GET /document/:documentId/page/:pageNumber - Image streaming endpoint
 * @route GET /document/:documentId/view/page/:pageNumber - Page viewer endpoint
 * @route GET /document/:documentId/view/text/page/:pageNumber - Text viewer endpoint
 */
function createDocumentRouter(options = {}) {
    const {
        createDocumentMetadataService: createMetadataServiceFactory = createDocumentMetadataService,
        createPageChunksService: createPageChunksServiceFactory = createPageChunksService,
        createSavedSearchStore = createSavedSearchStoreDefault
    } = options;
    const router = express.Router();
    let savedSearchStore = null;

    if (typeof createSavedSearchStore === 'function') {
        try {
            savedSearchStore = createSavedSearchStore();
        } catch {
            // Keep legacy searchTerm flow when persistence is not configured.
            savedSearchStore = null;
        }
    }

    const findSavedSearchById = async (searchId) => {
        if (!savedSearchStore?.getById) {
            return null;
        }
        try {
            return await savedSearchStore.getById(searchId);
        } catch {
            return null;
        }
    };

    // Create S3 client
    const s3Client = createS3Client();

    // IMAGE STREAMING ENDPOINT
    // GET /document/:documentId/page/:pageNumber
    router.get(
        '/:documentId/page/:pageNumber',
        validateDocumentParams(),
        createImageStreamingHandler(s3Client, createMetadataServiceFactory)
    );

    // PAGE VIEWER ENDPOINT
    // GET /document/:documentId/view/page/:pageNumber
    router.get(
        '/:documentId/view/page/:pageNumber',
        validateDocumentParams(),
        createPageViewerHandler(
            createMetadataServiceFactory,
            createPageChunksServiceFactory,
            undefined,
            {
                findSavedSearchById
            }
        )
    );

    // TEXT VIEWER ENDPOINT
    // GET /document/:documentId/view/text/page/:pageNumber
    router.get(
        '/:documentId/view/text/page/:pageNumber',
        validateDocumentParams(),
        createTextViewerHandler(
            createMetadataServiceFactory,
            createPageChunksServiceFactory,
            undefined,
            {
                findSavedSearchById
            }
        )
    );

    return router;
}

export default createDocumentRouter;
