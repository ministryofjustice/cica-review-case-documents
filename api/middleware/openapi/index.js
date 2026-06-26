import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and returns an Express Router that serves the Swagger UI docs and OpenAPI spec.
 * This is only used in non-production environments.
 * @param {object} [options] - Optional configuration.
 * @param {Function} [options.readOpenApiFile] - Optional file reader for DI in tests.
 * @param {() => import('express').RequestHandler} options.docsRateLimiter - Factory that returns a fresh rate limiter instance.
 * @param {import('express').RequestHandler} options.docsAuthMiddleware - Auth middleware for docs protection (JWT or session-based).
 * @returns {Promise<import('express').Router>} A configured Express Router.
 * @throws {Error}  If docsAuthMiddleware/docsRateLimiter are not provided.
 */
export default async function createDocsRouter(options = {}) {
    if (!options.docsAuthMiddleware) {
        throw new Error('createDocsRouter requires options.docsAuthMiddleware to be provided');
    }

    if (!options.docsRateLimiter) {
        throw new Error('createDocsRouter requires options.docsRateLimiter to be provided');
    }

    const openApiPath = path.resolve(__dirname, '../../openapi/openapi-dist.json');
    const readOpenApiFile = options.readOpenApiFile || readFile; // DI to allow the try/catch to be tested
    const authMiddleware = options.docsAuthMiddleware;
    let openApiSpec = {};
    try {
        openApiSpec = JSON.parse(await readOpenApiFile(openApiPath, 'utf-8'));
    } catch (err) {
        console.error({ err }, 'Failed to load OpenAPI spec');
    }

    const docsRouter = express.Router();
    // Rate limit first (before auth) to protect against brute-force on auth endpoint.
    // This is appropriate for session-based auth: the session is established in the main app's
    // auth handlers, and IP-based rate limiting protects the docs endpoint itself.
    // Note: docs authentication is session-based (not JWT), so identity is not available at this stage.
    docsRouter.use(options.docsRateLimiter());
    // Then authenticate to gate access to docs
    docsRouter.use(authMiddleware);

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
