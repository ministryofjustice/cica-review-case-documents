import apiSpec from '../../openapi/openapi.json' with { type: 'json' };

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
 * Maps express-openapi-validator error paths to OpenAPI specification references.
 *
 * When express-openapi-validator encounters a validation error, it provides a path
 * indicating where the error occurred (e.g., '/params/query' for the query parameter).
 * This map connects those error paths to their corresponding OpenAPI spec references,
 * allowing us to extract custom error messages defined in the spec's errorMessage property.
 *
 * HOW IT WORKS:
 * 1. express-openapi-validator validates requests against openapi.json
 * 2. On validation failure, it returns an error with a path (e.g., '/params/query')
 * 3. This map translates that path to a JSON Pointer in the OpenAPI spec
 * 4. We resolve the pointer to get the parameter's schema with custom errorMessage
 *
 * MAINTENANCE:
 * - Add entries here whenever you define custom errorMessages for new parameters
 * - The key is the error path from express-openapi-validator (format: '/params/{paramName}')
 * - The value is a JSON Pointer to the parameter in openapi.json (format: '#/components/parameters/{paramName}')
 *
 * CURRENTLY MAPPED:
 * - query: Has custom minLength/maxLength error messages in openapi-src.json
 *
 * NOT MAPPED (no custom error messages defined):
 * - pageNumber: Uses default validation messages
 * - itemsPerPage: Uses default validation messages
 * - onBehalfOf (On-Behalf-Of header): Uses default validation messages
 *
 * EXAMPLE: To add custom messages for pageNumber:
 * 1. Add x-errorMessage to pageNumber schema in openapi-src.json
 * 2. Add mapping: '/params/pageNumber': '#/components/parameters/pageNumber'
 * 3. Rebuild the spec with: npm run build:openapi
 *
 * @type {Object.<string, string>}
 */
const QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP = {
    '/params/query': '#/components/parameters/query'
};

/**
 * Error codes emitted by express-openapi-validator for JSON Schema validation failures.
 * These codes follow the pattern: {validationType}.openapi.validation
 *
 * @see https://github.com/cdimascio/express-openapi-validator
 * @type {Object.<string, string>}
 */
const OPENAPI_VALIDATOR_ERROR_CODES = {
    MIN_LENGTH: 'minLength.openapi.validation',
    MAX_LENGTH: 'maxLength.openapi.validation',
    PATTERN: 'pattern.openapi.validation'
};

/**
 * Maps OpenAPI validation error codes to schema property names.
 * Used to look up custom error messages in OpenAPI spec.
 * @type {Object.<string, string>}
 */
const OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP = {
    [OPENAPI_VALIDATOR_ERROR_CODES.MIN_LENGTH]: 'minLength',
    [OPENAPI_VALIDATOR_ERROR_CODES.MAX_LENGTH]: 'maxLength',
    [OPENAPI_VALIDATOR_ERROR_CODES.PATTERN]: 'pattern'
};

/**
 * Resolves a JSON pointer path (e.g., '#/components/parameters/query') to a value in an object.
 *
 * JSON Pointers (RFC 6901) use the '#/' prefix followed by path segments separated by '/'.
 * Example: '#/components/parameters/query' resolves to obj.components.parameters.query
 *
 * @param {Object} obj - The object to resolve the path against.
 * @param {string} pointer - The JSON pointer path (must start with '#/').
 * @returns {*} The resolved value, or undefined if not found.
 */
function resolveJsonPath(obj, pointer) {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }
    // JSON Pointers must start with '#/' per RFC 6901
    if (!pointer?.startsWith('#/')) {
        return undefined;
    }
    return pointer
        .slice(2) // Remove the '#/' prefix
        .split('/') // Split into path segments
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

export { OPENAPI_VALIDATOR_ERROR_CODES };
