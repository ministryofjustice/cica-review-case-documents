/**
 * Express application setup for the CICA FIND Case Documents API.
 *
 * - Configures JSON and URL-encoded body parsing.
 * - Sets response headers for content type and application version.
 * - Secures endpoints using JWT authentication.
 * - Integrates OpenAPI validation middleware for request and response validation.
 * - Routes API requests through the main router.
 * - Handles 404 errors for unmatched endpoints.
 * - Centralizes error handling and logging.
 *
 * @module app
 */

/**
 * Middleware to authenticate JWT tokens in the Authorization header.
 *
 * @function authenticateToken
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {void}
 */
import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import errorHandler from './middleware/errorHandler/index.js';
import apiRouter from './routes.js';
import jwt from 'jsonwebtoken';
import generalRateLimiter from '../auth/rateLimiters/generalRateLimiter.js';

const app = express();

/**
 * Middleware to authenticate JWT token from the Authorization header.
 * If the token is missing, responds with 401 Unauthorized.
 * If the token is invalid, responds with 403 Forbidden.
 * On success, attaches the decoded user object to req.user and calls next().
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    jwt.verify(token, process.env.APP_JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

app.use(express.json({ type: 'application/vnd.api+json' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.type('application/vnd.api+json');
    res.set('Application-Version', process.env.npm_package_version);
    next();
});

app.use(generalRateLimiter);

app.use(
    '/',
    OpenApiValidator.middleware({
        apiSpec: './api/openapi/openapi.json',
        validateRequests: true,
        validateResponses: true,
        validateSecurity: false
    }),
    apiRouter
);

// Express doesn't treat 404s as errors. If the following handler has been reached then nothing else matched e.g. a 404
// https://expressjs.com/en/starter/faq.html#how-do-i-handle-404-responses
app.use((req) => {
    const err = Error(`Endpoint ${req.url} does not exist`);
    err.name = 'HTTPError';
    err.statusCode = 404;
    err.error = '404 Not Found';
    throw err;
});

app.use((err, req, res, next) => {
    // Get pino to attach the correct error and stack trace to the log entry
    // https://github.com/pinojs/pino-http/issues/61
    res.err = {
        name: err.name,
        message: err.message,
        stack: err.stack
    };

    // forward the centralised error handler
    next(err);
});

app.use(errorHandler);

export default app;
