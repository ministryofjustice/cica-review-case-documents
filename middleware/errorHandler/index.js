'use strict';

const STATUS_TITLES_MAP = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    default: 'Error'
};

const NAME_STATUS_MAP = {
    'UnauthorizedError': 401,
    'ResourceNotFound': 404,
    'ConfigurationError': 500,
    default: 500
};

function formatError({
    status,
    detail,
    source,
    code,
    meta
}) {
    const errorData = {
        status: status.toString(),
        title: STATUS_TITLES_MAP[status] || STATUS_TITLES_MAP.default
    };
    if (detail) {
        errorData.detail = detail;
    }
    if (source) {
        errorData.source = source;
    }
    if (code) {
        errorData.code = code;
    }
    if (meta) {
        errorData.meta = meta;
    }
    return errorData;
}

// Central error handler
// https://www.joyent.com/node-js/production/design/errors
// https://github.com/i0natan/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md
export default (err, req, res, next) => {
    const errorResponse = { errors: [] };
    const log = req.log || console;

    // handle a malformed JSON request e.g. can't be parsed by the bodyparser (express.json)
    // https://github.com/expressjs/body-parser/issues/122#issuecomment-328190379
    if (err.type === 'entity.parse.failed') {
        const formattedError = formatError({
            status: 400,
            detail: 'Request JSON is malformed'
        });
        errorResponse.errors.push(formattedError);
        log.warn({
            err,
            error: formattedError
        }, 'UNHANDLED ERROR');
        return res.status(400).json(errorResponse);
    }

    let status = err.status || err.statusCode || NAME_STATUS_MAP[err.name] || NAME_STATUS_MAP.default;

    if (Array.isArray(err.errors)) {
        err.errors.forEach(e => {
            const formattedError = formatError({
                status,
                detail: e.message,
                source: e.path ? { pointer: `/${e.path.replace(/\./g, '/')}` } : undefined
            })
            errorResponse.errors.push(formattedError);
        });

        log.error({
            err,
            errors: errorResponse.errors,
            status
        }, 'UNHANDLED ERRORS');
        return res.status(status).json(errorResponse);
    }

    const formattedError = formatError({
        status,
        detail: err.message
    });
    errorResponse.errors.push(formattedError);

    log.error({
        err,
        errors: errorResponse.errors,
        status
    }, 'UNHANDLED ERROR');

    return res.status(status).json(errorResponse);
};
