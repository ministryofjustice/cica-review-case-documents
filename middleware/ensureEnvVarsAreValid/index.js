import VError from 'verror';
import isLogger from '../logger/utils/isLogger/index.js';

/**
 * Default configuration object specifying required and optional environment variables.
 *
 * @typedef {Object} Defaults
 * @property {Object} envVars - Environment variables configuration.
 * @property {string[]} envVars.mandatory - List of mandatory environment variable names.
 * @property {string[]} envVars.optional - List of optional environment variable names.
 */
const defaults = {
    envVars: {
        mandatory: [
            'APP_COOKIE_NAME',
            'APP_COOKIE_SECRET',
            'APP_API_URL',
            'APP_BASE_URL',
            'APP_JWT_SECRET',
            'APP_API_JWT_ISSUER',
            'APP_API_JWT_AUDIENCE',
            'APP_DATABASE_URL',
            'OPENSEARCH_INDEX_CHUNKS_NAME',
            'ENTRA_CLIENT_ID',
            'ENTRA_CLIENT_SECRET',
            'ENTRA_TENANT_ID'
        ],
        optional: [
            'PORT',
            'APP_SEARCH_PAGINATION_ITEMS_PER_PAGE',
            'APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE',
            'APP_API_JWT_EXPIRES_IN',
            'APP_ENTRA_RATE_LIMIT_WINDOW_MS',
            'APP_ENTRA_RATE_LIMIT_MAX_LOGIN',
            'APP_ENTRA_RATE_LIMIT_MAX_CALLBACK',
            'ENTRA_SCOPE',
            'ENTRA_INTERACTIVE_FALLBACK',
            'ENTRA_AUTH_TRANSACTION_MAX_AGE_MS',
            'ENTRA_JWKS_CACHE_TTL_MS',
            'APP_LOG_LEVEL',
            'APP_LOG_REDACT_EXTRA',
            'APP_LOG_REDACT_DISABLE'
        ]
    }
};

const MAX_APP_API_JWT_EXPIRES_IN_SECONDS = 300;

/**
 * Converts a short duration string like "60s" or "5m" into seconds.
 *
 * @param {string} value - Duration string from APP_API_JWT_EXPIRES_IN.
 * @returns {number | null} Duration in seconds or null for invalid format.
 */
function durationToSeconds(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const match = value.trim().match(/^(\d+)([sm])$/i);
    if (!match) {
        return null;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    return unit === 'm' ? amount * 60 : amount;
}

/**
 * Validates APP_API_JWT_EXPIRES_IN if present.
 * Allowed format: positive integer followed by "s" or "m" (for example: "60s", "5m").
 * Enforces a maximum TTL of 300 seconds.
 *
 * @throws {VError} Throws ConfigurationError when value is malformed or exceeds maximum.
 */
function checkAppApiJwtExpiresIn() {
    const expiresIn = process.env.APP_API_JWT_EXPIRES_IN;

    if (expiresIn === undefined) {
        return;
    }

    const expiresInSeconds = durationToSeconds(expiresIn);
    if (expiresInSeconds === null) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            'Environment variable "APP_API_JWT_EXPIRES_IN" must be a positive duration ending with "s" or "m" (for example "60s" or "5m")'
        );
    }

    if (expiresInSeconds > MAX_APP_API_JWT_EXPIRES_IN_SECONDS) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            `Environment variable "APP_API_JWT_EXPIRES_IN" must be <= ${MAX_APP_API_JWT_EXPIRES_IN_SECONDS}s`
        );
    }
}

/**
 * Retrieves the list of mandatory environment variables required by the application.
 *
 * @returns {string[]} An array of mandatory environment variable names.
 */
function getMandatoryEnvVars() {
    return defaults.envVars.mandatory;
}

/**
 * Retrieves the list of optional environment variables from the defaults configuration.
 *
 * @returns {Array<string>} An array of optional environment variable names.
 */
function getOptionalEnvVars() {
    return defaults.envVars.optional;
}

/**
 * Checks that all mandatory environment variables are set and valid.
 * Throws a ConfigurationError if any mandatory environment variable is missing or undefined.
 *
 * @param {string[]} [mandatoryEnvVars=getMandatoryEnvVars()] - An array of mandatory environment variable names to check.
 * @throws {VError} Throws if mandatoryEnvVars is not a non-empty array or if any required environment variable is missing.
 */
function checkMandatoryEnvVars(mandatoryEnvVars = getMandatoryEnvVars()) {
    if (!Array.isArray(mandatoryEnvVars) || mandatoryEnvVars.length === 0) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            `"mandatoryEnvVars" must be a non-empty array`
        );
    }

    mandatoryEnvVars.forEach((mandatoryEnvVar) => {
        const value = process.env[mandatoryEnvVar];
        if (value === undefined || typeof value !== 'string' || value.trim() === '') {
            throw new VError(
                {
                    name: 'ConfigurationError'
                },
                `Environment variable "${mandatoryEnvVar}" must be set and non-empty`
            );
        }
    });
}

/**
 * Validates APP_BASE_URL for trusted Entra redirect URI generation.
 *
 * Requires an absolute URL. In production the URL must use https. In non-production,
 * https is allowed everywhere and http is only allowed for localhost.
 *
 * @throws {VError} Throws ConfigurationError when APP_BASE_URL is missing or unsafe.
 */
function checkAppBaseUrlForEntraRedirectUri() {
    const appBaseUrl = process.env.APP_BASE_URL;
    const hasNonEmptyAppBaseUrl = typeof appBaseUrl === 'string' && appBaseUrl.trim().length > 0;

    if (hasNonEmptyAppBaseUrl) {
        let parsedUrl;

        try {
            parsedUrl = new URL(appBaseUrl);
        } catch {
            throw new VError(
                {
                    name: 'ConfigurationError'
                },
                'Environment variable "APP_BASE_URL" must be a valid absolute URL for Entra redirect URI'
            );
        }

        const isHttps = parsedUrl.protocol === 'https:';
        const isLocalHttp = parsedUrl.protocol === 'http:' && parsedUrl.hostname === 'localhost';

        if (process.env.NODE_ENV === 'production' && !isHttps && !isLocalHttp) {
            throw new VError(
                {
                    name: 'ConfigurationError'
                },
                'Environment variable "APP_BASE_URL" must use https in production for Entra redirect URI'
            );
        }

        if (!isHttps && !isLocalHttp) {
            throw new VError(
                {
                    name: 'ConfigurationError'
                },
                'Environment variable "APP_BASE_URL" must use https or be http://localhost for Entra redirect URI'
            );
        }

        return;
    }

    throw new VError(
        {
            name: 'ConfigurationError'
        },
        'Environment variable "APP_BASE_URL" must be set and non-empty for Entra redirect URI'
    );
}

/**
 * Checks the presence of optional environment variables and logs a debug message for each variable that is not set.
 *
 * @param {string[]} [optionalEnvVars=getOptionalEnvVars()] - An array of optional environment variable names to check. Defaults to the result of getOptionalEnvVars().
 * @param {Object} logger - A logger instance with a debug method for logging missing environment variables.
 * @throws {VError} Throws if optionalEnvVars is not a non-empty array.
 */
function checkOptionalEnvVars(optionalEnvVars = getOptionalEnvVars(), logger) {
    if (!Array.isArray(optionalEnvVars)) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            `"optionalEnvVars" must be a non-empty array`
        );
    }

    // Keep this list aligned with all supported runtime tuning variables.
    // Review optional env vars whenever new configurable settings are added.

    optionalEnvVars.forEach((optionalEnvVar) => {
        if (!(optionalEnvVar in process.env) || process.env[optionalEnvVar] === undefined) {
            logger.debug(
                {
                    data: {
                        environmentVariableName: optionalEnvVar
                    }
                },
                'OPTIONAL ENV VAR NOT SET'
            );
        }
    });
}

/**
 * Validates that the provided logger is a valid pino or pino-http logger instance.
 * Throws a ConfigurationError if the logger is invalid.
 *
 * @param {*} logger - The logger instance to validate.
 * @throws {VError} Throws if the logger is not a valid pino or pino-http logger.
 */
function checkIsLogger(logger) {
    if (!isLogger(logger)) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            'Invalid logger instance: expected a pino or pino-http logger middleware'
        );
    }
}

/**
 * Checks the validity of mandatory and optional environment variables.
 *
 * @param {Object} [options={}] - The options object.
 * @param {string[]} [options.mandatoryEnvVars=getMandatoryEnvVars()] - Array of mandatory environment variable names.
 * @param {string[]} [options.optionalEnvVars=getOptionalEnvVars()] - Array of optional environment variable names.
 * @param {Object} options.logger - Logger instance used for logging validation results.
 *
 * @throws {Error} If the logger is invalid or mandatory environment variables are missing.
 */
function checkEnvVars({
    mandatoryEnvVars = getMandatoryEnvVars(),
    optionalEnvVars = getOptionalEnvVars(),
    logger
} = {}) {
    checkIsLogger(logger);
    checkMandatoryEnvVars(mandatoryEnvVars);
    checkOptionalEnvVars(optionalEnvVars, logger);
    checkAppBaseUrlForEntraRedirectUri();
    checkAppApiJwtExpiresIn();
}

/**
 * Express middleware to validate required and optional environment variables.
 * Calls `checkEnvVars` with the lists of mandatory and optional environment variables,
 * and logs using the request logger. Proceeds to the next middleware after validation.
 *
 * @param {import('express').Request} req - Express request object, expected to have a `log` property for logging.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
function ensureEnvVarsAreValid(req, res, next) {
    checkEnvVars({
        mandatoryEnvVars: getMandatoryEnvVars(),
        optionalEnvVars: getOptionalEnvVars(),
        logger: req.log
    });
    next();
}

export { checkEnvVars, getMandatoryEnvVars, getOptionalEnvVars };

export default ensureEnvVarsAreValid;
