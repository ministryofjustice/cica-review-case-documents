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
            'APP_DATABASE_URL',
            'OPENSEARCH_INDEX_CHUNKS_NAME'
        ],
        optional: [
            'PORT',
            'APP_SEARCH_PAGINATION_ITEMS_PER_PAGE',
            'APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE',
            'APP_LOG_LEVEL',
            'APP_LOG_REDACT_EXTRA',
            'APP_LOG_REDACT_DISABLE'
        ]
    }
};

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
        if (!(mandatoryEnvVar in process.env) || process.env[mandatoryEnvVar] === undefined) {
            throw new VError(
                {
                    name: 'ConfigurationError'
                },
                `Environment variable "${mandatoryEnvVar}" must be set`
            );
        }
    });
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

    optionalEnvVars.forEach((optionalEnvVar) => {
        if (!(optionalEnvVar in process.env) || process.env[optionalEnvVar] === undefined) {
            // Optional environment variable not set
            // TODO review
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
    checkMandatoryEnvVars(mandatoryEnvVars, logger);
    checkOptionalEnvVars(optionalEnvVars, logger);
}

/**
 * Express middleware that validates required and optional environment variables.
 * Calls `checkEnvVars` with lists of mandatory and optional environment variables,
 * and logs the results using the request logger.
 *
 * @param {import('express').Request} req - Express request object, expected to have a `log` property for logging.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function ensureEnvVarsAreValid(req, res, next) {
    checkEnvVars({
        mandatoryEnvVars: getMandatoryEnvVars(),
        optionalEnvVars: getOptionalEnvVars(),
        logger: req.log
    });
    next();
}

export { getMandatoryEnvVars, getOptionalEnvVars, checkEnvVars };

export default ensureEnvVarsAreValid;
