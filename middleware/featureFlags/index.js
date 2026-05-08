import { DEFAULT_SEARCH_TYPE, resolveSearchType } from '../../api/search/constants/searchTypes.js';

export const FEATURE_FLAG_DEFAULTS = Object.freeze({
    align: true, // toggle alignment of image highlighting to prevent or show overlapping
    keyword: true, // enable lexical (BM25) keyword matching
    semantic: false, // enable neural (vector) semantic matching
    dates: true // enable date extraction and variant expansion in lexical matching
});

/**
 * Parses a query-string feature flag value.
 *
 * Accepts `on` and `off` values and ignores any other input.
 *
 * @param {unknown} value - Raw query-string value.
 * @returns {boolean | undefined} Parsed boolean value when valid.
 */
export function parseFeatureFlagValue(value) {
    const flagValue = Array.isArray(value) ? value.at(-1) : value;

    if (typeof flagValue !== 'string') {
        return undefined;
    }

    switch (flagValue.trim().toLowerCase()) {
        case 'on':
            return true;
        case 'off':
            return false;
        default:
            return undefined;
    }
}

/**
 * Parses a query-string enum feature flag value against a set of allowed values.
 *
 * @deprecated No longer used — all flags are booleans. Retained for potential external use.
 * @param {unknown} value - Raw query-string value.
 * @param {readonly string[]} allowedValues - Valid values for this flag.
 * @returns {string | undefined} Matched value when valid, otherwise undefined.
 */
export function parseEnumFlagValue(value, allowedValues) {
    const flagValue = Array.isArray(value) ? value.at(-1) : value;

    if (typeof flagValue !== 'string') {
        return undefined;
    }

    const normalized = flagValue.trim().toLowerCase();
    return allowedValues.includes(normalized) ? normalized : undefined;
}

/**
 * Resolves a feature flag value from session state, with repo defaults.
 *
 * @param {import('express-session').Session | undefined} session - Request session object.
 * @param {'align' | 'keyword' | 'semantic' | 'dates'} flagName - Supported feature flag name.
 * @returns {boolean} The active feature flag value.
 */
export function getFeatureFlagValue(session, flagName) {
    const sessionFlagValue = session?.featureFlags?.[flagName];
    const defaultValue = FEATURE_FLAG_DEFAULTS[flagName];

    if (typeof sessionFlagValue === 'boolean') {
        return sessionFlagValue;
    }

    return defaultValue;
}

/**
 * Persists supported feature flags from query-string params into the session.
 *
 * Recognised query-string values: `on` (true) and `off` (false).
 * Flags: `keyword`, `semantic`, `dates`, `align`.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function featureFlags(req, res, next) {
    const flags = {};

    if (req.session) {
        for (const flagName of Object.keys(FEATURE_FLAG_DEFAULTS)) {
            // Initialize with session value or default, but validate the type flag.
            // This ensures an invalid existing session type doesn't persist and
            // get re-added to URLs or exposed through res.locals.featureFlags.
            if (flagName === 'type') {
                flags[flagName] = resolveSearchType(req.session?.featureFlags?.type, req.session);
            } else {
                flags[flagName] = getFeatureFlagValue(req.session, flagName);
            }

            const queryFlagValue = parseFeatureFlagValue(req.query?.[flagName]);
            if (typeof queryFlagValue === 'boolean') {
                flags[flagName] = queryFlagValue;
            }
        }
        req.session.featureFlags = flags;
        res.locals.featureFlags = flags;
    }
    next();
}
