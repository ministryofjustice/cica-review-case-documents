import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import errorHandler from './middleware/errorHandler/index.js';
import authenticateJWTToken from './middleware/jwt-authentication/index.js';
import dynamicRateLimiter from './middleware/rateLimiter/index.js';
import createOpenApiValidatorMiddleware from './middleware/validator/index.js';
import createApiRouter from './document/routes.js';
import createSearchService from './search/search-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures an Express application for the API.
 * @param {object} [options] - Optional configuration for the app.
 * @param {object} [options.logger] - An optional logger instance.
 * @param {Function} [options.createSearchService] - A factory function to create the search service.
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

    const openApiPath = path.join(__dirname, 'openapi', 'openapi-dist.json');
    let openApiSpec = {};
    try {
        openApiSpec = JSON.parse(await readFile(openApiPath, 'utf-8'));
    } catch (err) {
        // Use the app's logger instance if available
        (app.get('logger') || console).error({ err }, 'Failed to load OpenAPI spec');
    }

    // --- API Routes (Protected and Validated) ---
    const docsRouter = express.Router();
    docsRouter.use(authenticateJWTToken);
    if (process.env.DEPLOY_ENV !== 'production') {
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
    }
    docsRouter.get('/openapi.json', (req, res) => {
        res.json(openApiSpec);
    });

    // Mount docsRouter at /docs and /openapi.json
    app.use('/docs', docsRouter);
    app.use('/openapi.json', authenticateJWTToken, (req, res) => {
        res.json(openApiSpec);
    });

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

    app.use(
        '/',
        dynamicRateLimiter,
        authenticateJWTToken,
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
