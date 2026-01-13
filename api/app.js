import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';

import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import pino from 'pino';
import swaggerUi from 'swagger-ui-express';
import errorHandler from './middleware/errorHandler/index.js';
import authenticateJWTToken from './middleware/jwt-authentication/index.js';
import dynamicRateLimiter from './middleware/rateLimiter/index.js';
import apiRouter from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = pino({ level: process.env.APP_LOG_LEVEL || 'info' });
const app = express();

const ajv = new Ajv({
    allErrors: true
});
ajvErrors(ajv, { singleError: true });

app.use(express.json({ type: 'application/vnd.api+json' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting and authentication to ALL API routes first
app.use(dynamicRateLimiter);
app.use(authenticateJWTToken);

// Serve Swagger UI and OpenAPI spec used for validation
const openApiPath = path.join(__dirname, 'openapi', 'openapi-dist.json');

// Serve Swagger UI and OpenAPI spec only in non-production environments
let openApiSpec = null;
if (process.env.DEPLOY_ENV !== 'production') {
    try {
        openApiSpec = JSON.parse(await readFile(openApiPath, 'utf-8'));
    } catch (err) {
        logger.error({ err }, 'Failed to load OpenAPI spec');
        openApiSpec = {};
    }

    // Middleware to relax CSP for Swagger UI documentation
    const relaxCspForSwaggerUI = (req, res, next) => {
        const existingCsp = res.getHeader('Content-Security-Policy');
        if (existingCsp) {
            const modifiedCsp = existingCsp
                .replace(/'strict-dynamic'\s*/g, '')
                .replace(/script-src ([^;]+)/, `script-src $1 'unsafe-eval'`);
            res.setHeader('Content-Security-Policy', modifiedCsp);
        }
        next();
    };

    app.use('/docs', relaxCspForSwaggerUI, swaggerUi.serve, swaggerUi.setup(openApiSpec));
    app.get('/openapi.json', (req, res) => {
        res.json(openApiSpec);
    });
}

// This middleware sets the content type and version for all subsequent API routes.
const apiSetupMiddleware = (req, res, next) => {
    res.type('application/vnd.api+json');
    res.set('Application-Version', process.env.npm_package_version);
    next();
};

app.use(authenticateJWTToken);
app.use(dynamicRateLimiter);

// OpenApiValidator validates all subsequent routes
app.use(
    '/',
    apiSetupMiddleware,
    OpenApiValidator.middleware({
        apiSpec: openApiPath,
        validateRequests: true,
        validateResponses: true,
        validateSecurity: false,
        ajv: {
            instance: ajv
        }
    }),
    apiRouter
);

// 404 handler
app.use((req) => {
    const err = Error(`Endpoint ${req.url} does not exist`);
    err.name = 'HTTPError';
    err.statusCode = 404;
    err.error = '404 Not Found';
    throw err;
});

// Error logging
app.use((err, req, res, next) => {
    res.err = {
        name: err.name,
        message: err.message,
        stack: err.stack
    };
    next(err);
});

app.use(errorHandler);

export default app;
