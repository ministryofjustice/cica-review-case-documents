'use strict';

import VError from 'verror';

// Central error handler
// https://www.joyent.com/node-js/production/design/errors
// https://github.com/i0natan/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md
export default (err, req, res, next) => {
    const error = {errors: []};

    // handle a malformed JSON request e.g. can't be parsed by the bodyparser (express.json)
    // https://github.com/expressjs/body-parser/issues/122#issuecomment-328190379
    if ('type' in err && err.type === 'entity.parse.failed') {
        error.errors.push({
            status: 400,
            title: 'Bad Request',
            detail: 'Request JSON is malformed'
        });

        return res.status(400).json(error);
    }

    if (err.status === 400) {
        err.errors.forEach(errorObj => {
            error.errors.push({
                status: 400,
                title: '400 Bad Request',
                detail: errorObj.message,
                source: {pointer: `/${errorObj.path.replace(/\./g, '/')}`}
            });
        });

        return res.status(400).json(error);
    }

    if (err.name === 'JSONSchemaValidationError') {
        const errorInfo = VError.info(err);
        const jsonApiErrors = errorInfo.schemaErrors.map(errorObj => ({
            status: 400,
            title: '400 Bad Request',
            detail: errorObj.message,
            code: errorObj.keyword,
            // The validation is happening on the properties of /data/attributes. This causes the dataPath
            // to be empty as it's technically the top level. Prefix all pointers with the parent path.
            source: {pointer: `/data/attributes${errorObj.dataPath}`},
            meta: {
                // include the raw ajv error
                raw: errorObj
            }
        }));

        error.errors.push(...jsonApiErrors);
        error.meta = {
            schema: errorInfo.schema,
            answers: errorInfo.coercedAnswers
        };

        return res.status(400).json(error);
    }

    if (err.statusCode === 400) {
        error.errors.push({
            status: 400,
            title: '400 Bad Request',
            detail: err.message
        });

        return res.status(400).json(error);
    }

    if (err.statusCode === 403) {
        error.errors.push({
            status: 403,
            title: '403 Forbidden',
            detail: err.message
        });

        return res.status(403).json(error);
    }

    if (err.statusCode === 404) {
        error.errors.push({
            status: 404,
            title: '404 Not Found',
            detail: err.message
        });

        return res.status(404).json(error);
    }

    if (err.name === 'ResourceNotFound') {
        error.errors.push({
            status: 404,
            title: '404 Not Found',
            detail: err.message
        });

        return res.status(404).json(error);
    }

    if (err.name === 'UnauthorizedError') {
        error.errors.push({
            status: 401,
            title: '401 Unauthorized',
            detail: err.message
        });

        return res.status(401).json(error);
    }

    return next(err);
};
