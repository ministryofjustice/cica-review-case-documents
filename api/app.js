import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import errorHandler from '../middleware/errorHandler/index.js';
import apiRouter from './routes.js';
import jwt from 'jsonwebtoken';

const app = express();

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

app.use(authenticateToken);

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
