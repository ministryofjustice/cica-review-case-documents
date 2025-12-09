import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import errorHandler from '../middleware/errorHandler/index.js';
import authenticateJWTToken from './middleware/jwt-authentication/index.js';
import rateLimiter from './middleware/rateLimiter/index.js';
import apiRouter from './routes.js';

const app = express();

const ajv = new Ajv({
    allErrors: true
});
ajvErrors(ajv, { singleError: true });

app.use(express.json({ type: 'application/vnd.api+json' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.type('application/vnd.api+json');
    res.set('Application-Version', process.env.npm_package_version);
    next();
});

app.use(rateLimiter);
app.use(authenticateJWTToken);

app.use(
    '/',
    OpenApiValidator.middleware({
        apiSpec: './api/openapi/openapi-dist.json',
        validateRequests: true,
        validateResponses: true,
        ajv: {
            instance: ajv
        }
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
