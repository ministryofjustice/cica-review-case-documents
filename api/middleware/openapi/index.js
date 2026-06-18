import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import authenticateJWTToken from '../jwt-authentication/index.js';
import dynamicRateLimiter from '../rateLimiter/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and returns an Express Router that serves the Swagger UI docs and OpenAPI spec.
 * This is only used in non-production environments.
 * @param {object} [options] - Optional configuration.
 * @param {Function} [options.readOpenApiFile] - Optional file reader for DI in tests.
 * @returns {Promise<import('express').Router>} A configured Express Router.
 */
export default async function createDocsRouter(options = {}) {
    const openApiPath = path.resolve(__dirname, '../../openapi/openapi-dist.json');
    const readOpenApiFile = options.readOpenApiFile || readFile; // DI to allow the try/catch to be tested
    let openApiSpec = {};
    try {
        openApiSpec = JSON.parse(await readOpenApiFile(openApiPath, 'utf-8'));
    } catch (err) {
        console.error({ err }, 'Failed to load OpenAPI spec');
    }

    const docsRouter = express.Router();
    // Lightweight pre-auth IP limiter to prevent brute-force against auth-gated docs
    docsRouter.use(dynamicRateLimiter);
    docsRouter.use(authenticateJWTToken);

    // Serve Swagger UI
    docsRouter.use(
        '/',
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    'script-src': ["'self'", "'unsafe-inline'"],
                    'style-src': ["'self'", "'unsafe-inline'"]
                }
            }
        }),
        swaggerUi.serve,
        swaggerUi.setup(openApiSpec)
    );

    return docsRouter;
}
