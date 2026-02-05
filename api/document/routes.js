import express from 'express';
import searchRouter from '../search/routes.js';
import pageMetadataRouter from './page-metadata-routes.js';

/**
 * Creates and configures the main API router.
 *
 * @param {Object} options - The options object.
 * @param {Object} options.searchService - The service used for search operations.
 * @returns {import('express').Router} The configured Express router with the /search and page metadata routes mounted.
 */
export default function createApiRouter({ searchService }) {
    const router = express.Router();
    router.use('/search', searchRouter({ searchService }));
    router.use('/document', pageMetadataRouter());

    return router;
}
