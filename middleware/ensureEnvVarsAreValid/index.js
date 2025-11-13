import VError from 'verror';
import isLogger from '../logger/utils/isLogger/index.js';

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

function getMandatoryEnvVars() {
    return defaults.envVars.mandatory;
}

function getOptionalEnvVars() {
    return defaults.envVars.optional;
}

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

function checkEnvVars({
    mandatoryEnvVars = getMandatoryEnvVars(),
    optionalEnvVars = getOptionalEnvVars(),
    logger
} = {}) {
    checkIsLogger(logger);
    checkMandatoryEnvVars(mandatoryEnvVars, logger);
    checkOptionalEnvVars(optionalEnvVars, logger);
}

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
