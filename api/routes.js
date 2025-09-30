'use strict';

import express from 'express';
import OpenApiValidator from 'express-openapi-validator';
import searchRouter from './search/routes.js';
import errorHandler from '../middleware/errorHandler/index.js';

const router = express.Router();

router.use(express.json({type: 'application/vnd.api+json'}));
// https://expressjs.com/en/api.html#express.urlencoded
router.use(express.urlencoded({extended: true}));
router.use((req, res, next) => {
    // Default to JSON:API content type for all subsequent responses
    res.type('application/vnd.api+json');
    // https://stackoverflow.com/a/22339262/2952356
    // `process.env.npm_package_version` only works if you use npm start to run the app.
    res.set('Application-Version', process.env.npm_package_version);

    next();
});

// router.use(caseRouter);
router.use(
    '/search',
    OpenApiValidator.middleware({
        apiSpec: './api/openapi/openapi.json',
        validateRequests: true,
        validateResponses: false,
        validateSecurity: false
    }),
    searchRouter
);
// router.use(documentRouter);

router.use(errorHandler);

export default router;
