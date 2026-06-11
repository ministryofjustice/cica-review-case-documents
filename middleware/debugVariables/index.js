/**
 * Debug mode alterable variables configuration and middleware.
 *
 * Centralizes all variables that can be tuned in debug mode.
 * These are parsed from query parameters, stored in the session,
 * and made available to routes and services.
 */

import { DEFAULT_QUERY_DSL_CONFIG } from '../../api/DAL/utils/buildQueryJson/queryTypeBuilders.js';

/**
 * Defines all variables that can be altered in debug mode.
 * Each entry includes: name, type, default value, and validator.
 *
 * @type {Array<{name: string, type: string, default: number | boolean | string, validator: (val: any) => boolean}>}
 */
export const DEBUG_VARIABLES = Object.freeze([
    {
        name: 'semanticMinScore',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.semanticMinScore,
        validator: (val) => typeof val === 'number' && val >= 0 && Number.isFinite(val)
    },
    {
        name: 'semanticOnlyMinScore',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.semanticOnlyMinScore,
        validator: (val) => typeof val === 'number' && val >= 0 && Number.isFinite(val)
    },
    {
        name: 'semanticK',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.semanticK,
        validator: (val) => typeof val === 'number' && Number.isInteger(val) && val >= 1
    },
    {
        name: 'lexicalBoost',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.lexicalBoost,
        validator: (val) => typeof val === 'number' && val >= 0 && Number.isFinite(val)
    },
    {
        name: 'dateBoost',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.dateBoost,
        validator: (val) => typeof val === 'number' && val >= 0 && Number.isFinite(val)
    },
    {
        name: 'neuralBoost',
        type: 'number',
        default: DEFAULT_QUERY_DSL_CONFIG.neuralBoost,
        validator: (val) => typeof val === 'number' && val >= 0 && Number.isFinite(val)
    }
]);

const QUERY_DSL_DEBUG_VARIABLE_NAMES = Object.freeze([
    'semanticMinScore',
    'semanticOnlyMinScore',
    'semanticK',
    'lexicalBoost',
    'dateBoost',
    'neuralBoost'
]);

/**
 * Gets the names of all debug variables.
 *
 * @returns {string[]} Array of debug variable names.
 */
export function getDebugVariableNames() {
    return DEBUG_VARIABLES.map((v) => v.name);
}

/**
 * Gets the default values for all debug variables.
 *
 * @returns {Record<string, number>} Object mapping variable names to defaults.
 */
export function getDebugVariableDefaults() {
    const defaults = {};
    DEBUG_VARIABLES.forEach((v) => {
        defaults[v.name] = v.default;
    });
    return Object.freeze(defaults);
}

/**
 * Builds the debug query DSL config object used by templates/debug views.
 *
 * @param {Record<string, number>} [overrides={}] - Validated override values.
 * @returns {{defaults: Record<string, number>, overrides: Record<string, number>, effective: Record<string, number>}}
 */
export function buildDebugQueryDslConfig(overrides = {}) {
    const defaults = getDebugVariableDefaults();
    return {
        defaults,
        overrides,
        effective: {
            ...defaults,
            ...overrides
        }
    };
}

/**
 * Extracts only query-DSL-related debug variables from the full debug variable bag.
 *
 * @param {Record<string, unknown>} [debugVariables={}] - Full debug variables object.
 * @returns {Record<string, number>} Query DSL override values only.
 */
export function getQueryDslOverrides(debugVariables = {}) {
    const overrides = {};

    QUERY_DSL_DEBUG_VARIABLE_NAMES.forEach((key) => {
        const value = debugVariables[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            overrides[key] = value;
        }
    });

    return overrides;
}

/**
 * Converts a raw value (string, number, etc.) to the correct type for a debug variable.
 *
 * @param {string} varName - Name of the debug variable.
 * @param {unknown} rawValue - Raw value from query params or storage.
 * @returns {number | undefined} Converted value or undefined if invalid.
 */
function convertDebugVariableValue(varName, rawValue) {
    const varDef = DEBUG_VARIABLES.find((v) => v.name === varName);
    if (!varDef) return undefined;

    if (varDef.type === 'number') {
        const normalized = Array.isArray(rawValue) ? rawValue.at(-1) : rawValue;

        if (typeof normalized === 'number') {
            return varDef.validator(normalized) ? normalized : undefined;
        }

        if (typeof normalized === 'string') {
            const trimmed = normalized.trim();
            if (trimmed.length === 0) return undefined;
            const parsed = Number(trimmed);
            return varDef.validator(parsed) ? parsed : undefined;
        }
    }

    return undefined;
}

/**
 * Parses debug variables from query parameters.
 *
 * @param {Record<string, any>} query - Express query object.
 * @returns {Record<string, number>} Validated debug variable overrides.
 */
export function parseDebugVariablesFromQuery(query = {}) {
    const overrides = {};

    getDebugVariableNames().forEach((varName) => {
        const converted = convertDebugVariableValue(varName, query[varName]);
        if (converted !== undefined) {
            overrides[varName] = converted;
        }
    });

    return overrides;
}

/**
 * Validates debug variables from session or other storage.
 *
 * @param {Record<string, any>} sessionVars - Variables from session storage.
 * @returns {Record<string, number>} Validated variables with defaults filled in.
 */
export function validateDebugVariables(sessionVars = {}) {
    const validated = {};

    DEBUG_VARIABLES.forEach((varDef) => {
        const sessionValue = sessionVars[varDef.name];

        if (sessionValue !== undefined) {
            const isValid = varDef.validator(sessionValue);
            validated[varDef.name] = isValid ? sessionValue : varDef.default;
        } else {
            validated[varDef.name] = varDef.default;
        }
    });

    return validated;
}

/**
 * Middleware to parse and store debug variables in the session.
 *
 * Only active when debug mode is enabled. Parses query parameters,
 * validates them, and stores them in req.session.debugVariables.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function debugVariablesMiddleware(req, res, next) {
    if (!req.session) {
        return next();
    }

    // Only process debug variables when in debug context
    const featureFlags = res.locals?.featureFlags;
    const isDebugMode = featureFlags && featureFlags.debug === true;

    if (!isDebugMode) {
        // Initialize empty debug variables for non-debug mode
        req.session.debugVariables = {};
        res.locals.debugVariables = getDebugVariableDefaults();
        res.locals.debugQueryDslOverrides = {};
        res.locals.debugQueryDslConfig = buildDebugQueryDslConfig();
        return next();
    }

    // Parse overrides from query params
    const queryOverrides = parseDebugVariablesFromQuery(req.query);

    // Merge with session values, preferring query params
    const mergedVars = { ...getDebugVariableDefaults() };
    const sessionDebugVars = req.session.debugVariables || {};

    // Apply session values as fallback
    Object.assign(mergedVars, sessionDebugVars);

    // Apply query overrides on top
    Object.assign(mergedVars, queryOverrides);

    // Validate final state
    const validated = validateDebugVariables(mergedVars);

    // Store in session and response locals
    req.session.debugVariables = validated;
    res.locals.debugVariables = validated;
    const queryDslOverrides = getQueryDslOverrides(validated);
    res.locals.debugQueryDslOverrides = queryDslOverrides;
    res.locals.debugQueryDslConfig = buildDebugQueryDslConfig(queryDslOverrides);

    next();
}
