import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import express from 'express';
import pinoHttp from 'pino-http';
import createApiRouter from './document/routes.js';
import errorHandler from './middleware/errorHandler/index.js';
import authenticateJWTToken from './middleware/jwt-authentication/index.js';
import createDocsRouter from './middleware/openapi/index.js';
import createDynamicRateLimiter from './middleware/rateLimiter/index.js';
import createOpenApiValidatorMiddleware from './middleware/validator/index.js';
import createSearchService from './search/search-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures an Express application for the API.
 * @param {object} [options] - Optional configuration for the app.
 * @param {object} [options.logger] - An optional logger instance.
 * @param {Function} [options.createSearchService] - A factory function to create the search service.
 * @param {Function} [options.readOpenApiFile] - Optional file reader for loading OpenAPI spec (used by tests).
 * @param {import('express').RequestHandler} [options.docsAuthMiddleware] - Auth middleware for docs protection.
 *        Required when DEPLOY_ENV !== 'production' (docs routes are only mounted in non-production).
 * @returns {Promise<import('express').Application>} A promise that resolves to the configured Express app.
 */
export default async function createApi(options = {}) {
    const app = express();
    const logger = pinoHttp({ level: process.env.APP_LOG_LEVEL || 'info' });
    app.use(logger);

    const ajv = new Ajv({
        allErrors: true,
        coerceTypes: true,
        useDefaults: true,
        strict: false
    });
    ajvErrors(ajv, { singleError: true });

    app.use(express.json({ type: 'application/vnd.api+json' }));
    app.use(express.urlencoded({ extended: true }));

    if (process.env.DEPLOY_ENV !== 'production') {
        if (!options.docsAuthMiddleware) {
            throw new Error('createDocsRouter requires options.docsAuthMiddleware to be provided');
        }

        // Provide the rate limiter factory to the docs router so it can create
        // its own limiter during initialization. Create a separate limiter
        // instance for the /openapi.json route here.
        const docsRouter = await createDocsRouter({
            readOpenApiFile: options.readOpenApiFile,
            docsAuthMiddleware: options.docsAuthMiddleware,
            docsRateLimiter: createDynamicRateLimiter
        });

        app.use('/docs', docsRouter);

        // Also serve the spec at root for standard location using a fresh limiter
        const openApiLimiter = createDynamicRateLimiter();
        app.use('/openapi.json', openApiLimiter, options.docsAuthMiddleware, async (req, res) => {
            const readOpenApiFile = options.readOpenApiFile || readFile;
            try {
                const openApiPath = path.resolve(__dirname, 'openapi/openapi-dist.json');
                const openApiSpec = JSON.parse(await readOpenApiFile(openApiPath, 'utf-8'));
                res.json(openApiSpec);
            } catch (err) {
                (req.log || console).error({ err }, 'Failed to load OpenAPI spec');
                res.status(500).json({ error: 'Failed to load OpenAPI spec' });
            }
        });
    }

    // This middleware sets the content type and version for all subsequent API routes.
    const apiSetupMiddleware = (req, res, next) => {
        res.type('application/vnd.api+json');
        res.set('Application-Version', process.env.npm_package_version);
        next();
    };

    // Create the search service
    const searchServiceFactory = options.createSearchService || createSearchService;
    const searchService = searchServiceFactory({});
    const apiRouter = createApiRouter({ searchService });

    const openApiValidator = await createOpenApiValidatorMiddleware({ ajv, logger });
    const apiRateLimiter = createDynamicRateLimiter();
    app.use(
        '/',
        authenticateJWTToken,
        apiRateLimiter,
        apiSetupMiddleware,
        openApiValidator,
        apiRouter
    );

    // 404 handler for API routes
    app.use((req, res, next) => {
        const err = new Error(`Endpoint ${req.originalUrl} does not exist within the API`);
        err.name = 'HTTPError';
        err.statusCode = 404;
        err.error = '404 Not Found';
        next(err);
    });

    // Error logging and handling
    app.use((err, req, res, next) => {
        // Log the error details
        (req.log || console).error({ err }, 'API Error');
        next(err);
    });

    app.use(errorHandler);

    return app;
}
