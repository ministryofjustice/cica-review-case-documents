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
 * Converts a given path to a JSON Pointer format.
 *
 * If the path is already in JSON Pointer format (starts with '/'), it is returned as is.
 * If the path is in dot notation (e.g., 'a.b.c'), it is converted to JSON Pointer (e.g., '/a/b/c').
 * If the path is falsy, returns undefined.
 *
 * @param {string} path - The path to convert, in dot notation or JSON Pointer format.
 * @returns {string|undefined} The path in JSON Pointer format, or undefined if input is falsy.
 */
function toJsonPointer(path) {
    if (!path) return undefined;
    if (path.startsWith('/')) return path; // already JSON Pointer
    // Convert dot notation to JSON Pointer
    return `/${path.replace(/\./g, '/')}`;
}

/**
 * Formats an error object into a standardized error response.
 *
 * @param {Object} params - The error parameters.
 * @param {number} params.status - The HTTP status code of the error.
 * @param {string} [params.detail] - A detailed error message.
 * @param {Object} [params.source] - The source of the error, may include a pointer.
 * @param {string} [params.source.pointer] - A pointer to the associated entity in the request document.
 * @param {string} [params.code] - An application-specific error code.
 * @param {Object} [params.meta] - Additional meta information about the error.
 * @param {Object} [params.fullError] - The full error object, may include a custom error code.
 * @param {string} [params.fullError.errorCode] - A custom error code for OpenAPI errors.
 * @returns {Object} The formatted error object.
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
        // Convert source.pointer to JSON Pointer if needed
        errorData.source = { ...source };
        if (errorData.source.pointer) {
            errorData.source.pointer = toJsonPointer(errorData.source.pointer);
        }
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
    // TEMP LOG POINT: Log all errors entering the error handler
    // You can use req.log if available, or just console.log for debugging
    console.error('Error in error handler:', {
        name: err?.name,
        message: err?.message,
        status: err?.status,
        statusCode: err?.statusCode,
        errors: err?.errors,
        stack: err?.stack
    });

    // Always set JSON:API content type
    res.type('application/vnd.api+json');

    // Default status
    let status =
        err.statusCode ||
        err.status ||
        NAME_STATUS_MAP[err.name] ||
        (Array.isArray(err.errors) ? 400 : 500);

    // Malformed JSON: force 400
    if (err.type === 'entity.parse.failed') {
        status = 400;
    }

    // OpenAPI/validation errors: force 400
    if (
        Array.isArray(err.errors) ||
        err.name === 'RequestValidationError' ||
        err.name === 'ResponseValidationError' ||
        err.errorCode === 'invalid_request' ||
        err.errorCode === 'invalid_response'
    ) {
        status = 400;
    }

    // Fallback for unknown errors
    if (!status || typeof status !== 'number') {
        status = 500;
    }

    // Format errors as JSON:API error array
    let errors = [];

    if (Array.isArray(err.errors)) {
        // OpenAPI validation errors
        errors = err.errors.map((e) =>
            formatError({
                status,
                detail: e.message,
                source: e.path ? { pointer: e.path } : undefined,
                code: e.errorCode,
                fullError: e
            })
        );
    } else {
        // Single error
        errors = [
            formatError({
                status,
                detail: err.message || 'An unexpected error occurred',
                code: err.code,
                meta: err.meta,
                fullError: err
            })
        ];
    }

    res.status(status).json({ errors });
};
