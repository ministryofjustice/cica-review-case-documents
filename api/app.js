import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import errorHandler from '../middleware/errorHandler/index.js';
import apiRouter from './routes.js';

const router = express.Router();

router.use(express.json({type: 'application/vnd.api+json'}));
router.use(express.urlencoded({extended: true}));
router.use((req, res, next) => {
    res.type('application/vnd.api+json');
    res.set('Application-Version', process.env.npm_package_version);
    next();
});

router.use(
    '/',
    OpenApiValidator.middleware({
        apiSpec: './api/openapi/openapi.json',
        validateRequests: true,
        validateResponses: true,
        validateSecurity: false,
    }),
    apiRouter
);

router.use(req => {
    const err = Error(`Endpoint ${req.url} does not exist`);
    err.name = 'HTTPError';
    err.statusCode = 404;
    err.error = '404 Not Found';
    throw err;
});

router.use((err, req, res, next) => {
    res.err = {
        name: err.name,
        message: err.message,
        stack: err.stack
    };
    next(err);
});

router.use(errorHandler);

export default router;
