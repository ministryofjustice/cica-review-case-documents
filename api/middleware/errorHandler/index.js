import apiSpec from '../../openapi/openapi-dist.json' with { type: 'json' };

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

/**
 * Map of error names to HTTP status codes.
 * @typedef {Object} NAME_STATUS_MAP
 * @property {number} UnauthorizedError - 401
 * @property {number} ResourceNotFound - 404
 * @property {number} ConfigurationError - 500
 * @property {number} default - 500
 */
const NAME_STATUS_MAP = {
    UnauthorizedError: 401,
    ResourceNotFound: 404,
    ConfigurationError: 500,
    default: 500
};

/**
 * Maps query parameter paths to OpenAPI path parameter references.
 * Used for rendering meaningful error messages from OpenAPI spec.
 * @type {Object.<string, string>}
 */
const QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP = {
    '/query/query': '#/components/parameters/query'
};

/**
 * Maps OpenAPI validation error codes to schema property names.
 * Used to look up custom error messages in OpenAPI spec.
 * @type {Object.<string, string>}
 */
const OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP = {
    'minLength.openapi.validation': 'minLength',
    'maxLength.openapi.validation': 'maxLength',
    'pattern.openapi.validation': 'pattern'
};

/**
 * Resolves a JSON pointer path (e.g., '#/components/parameters/query') to a value in an object.
 *
 * @param {Object} obj - The object to resolve the path against.
 * @param {string} path - The JSON pointer path (e.g., '#/components/parameters/query').
 * @returns {*} The resolved value, or undefined if not found.
 */
function resolveJsonPath(obj, pointer) {
    if (!pointer?.startsWith('#/')) {
        return undefined;
    }
    return pointer
        .slice(2)
        .split('/')
        .reduce((current, key) => {
            return current?.[key];
        }, obj);
}

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

/**
 * Returns a custom error detail message from the OpenAPI spec if available.
 * Falls back to the default error message if no custom message is found.
 *
 * @param {Object} fullError - The error object containing path and errorCode.
 * @param {string} fullError.path - The error path (e.g., '/params/query').
 * @param {string} fullError.errorCode - The OpenAPI validation error code.
 * @param {string} fullError.message - The default error message.
 * @returns {string} The custom error message or the default error message.
 */
function getCustomOpenApiErrorDetail(fullError) {
    const { path, errorCode, message } = fullError;

    const pointer = QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP[path];
    if (!pointer) {
        return message;
    }

    const schema = resolveJsonPath(apiSpec, pointer)?.schema;
    if (!schema) {
        return message;
    }

    const schemaProperty = OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP[errorCode];
    if (!schemaProperty) {
        return message;
    }

    return schema?.errorMessage?.[schemaProperty] || message;
}

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
function formatError({ status, detail, source, code, meta, fullError }) {
    const errorData = {
        status: status.toString(),
        title: STATUS_TITLES_MAP[status] || STATUS_TITLES_MAP.default
    };

    if (fullError?.errorCode) {
        errorData.detail = getCustomOpenApiErrorDetail(fullError);
    } else if (detail) {
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
                source: e.path ? { pointer: `/${e.path.replace(/\./g, '/')}` } : undefined,
                fullError: e
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
