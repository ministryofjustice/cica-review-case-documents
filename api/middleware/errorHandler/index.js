/**
 * Map of HTTP status codes to their corresponding titles.
 * @typedef {Object} STATUS_TITLES_MAP
 * @property {string} 400 - Bad Request
 * @property {string} 401 - Unauthorized
 * @property {string} 403 - Forbidden
 * @property {string} 404 - Not Found
 * @property {string} 409 - Conflict
 * @property {string} 422 - Unprocessable Entity
 * @property {string} 429 - Too Many Requests
 * @property {string} 500 - Internal Server Error
 * @property {string} default - Error
 */

/**
 * Map of error names to HTTP status codes.
 * @typedef {Object} NAME_STATUS_MAP
 * @property {number} UnauthorizedError - 401
 * @property {number} ResourceNotFound - 404
 * @property {number} ConfigurationError - 500
 * @property {number} default - 500
 */

/**
 * Formats an error object into a standardized error response.
 *
 * @param {Object} params - Error parameters.
 * @param {number} params.status - HTTP status code.
 * @param {string} [params.detail] - Detailed error message.
 * @param {Object} [params.source] - Source of the error (e.g., pointer).
 * @param {string} [params.code] - Optional error code.
 * @param {Object} [params.meta] - Optional metadata.
 * @returns {Object} Formatted error object.
 */

/**
 * Centralized Express error handler middleware.
 *
 * Handles malformed JSON requests, arrays of errors, and single errors.
 * Logs errors and sends standardized error responses.
 *
 * @function
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void}
 */
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
    UnauthorizedError: 401,
    ResourceNotFound: 404,
    ConfigurationError: 500,
    default: 500
};

/**
 * Formats an error object according to the specified structure.
 *
 * @param {Object} params - The error parameters.
 * @param {number|string} params.status - The HTTP status code of the error.
 * @param {string} [params.detail] - A detailed error message.
 * @param {Object} [params.source] - The source of the error (e.g., pointer to the request).
 * @param {string} [params.code] - An application-specific error code.
 * @param {Object} [params.meta] - Additional metadata about the error.
 * @returns {Object} The formatted error object.
 */
function formatError({ status, detail, source, code, meta }) {
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
/**
 * Express error handling middleware.
 * Handles malformed JSON requests, arrays of errors, and generic errors.
 * Formats errors into a consistent response structure and logs them.
 *
 * @function
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
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
        log.warn(
            {
                err,
                error: formattedError
            },
            'UNHANDLED ERROR'
        );
        return res.status(400).json(errorResponse);
    }

    const status =
        err.status || err.statusCode || NAME_STATUS_MAP[err.name] || NAME_STATUS_MAP.default;

    if (Array.isArray(err.errors)) {
        err.errors.forEach((e) => {
            const formattedError = formatError({
                status,
                detail: e.message,
                source: e.path ? { pointer: `/${e.path.replace(/\./g, '/')}` } : undefined
            });
            errorResponse.errors.push(formattedError);
        });

        log.error(
            {
                err,
                errors: errorResponse.errors,
                status
            },
            'UNHANDLED ERRORS'
        );
        return res.status(status).json(errorResponse);
    }

    const formattedError = formatError({
        status,
        detail: err.message
    });
    errorResponse.errors.push(formattedError);

    log.error(
        {
            err,
            errors: errorResponse.errors,
            status
        },
        'UNHANDLED ERROR'
    );

    return res.status(status).json(errorResponse);
};
