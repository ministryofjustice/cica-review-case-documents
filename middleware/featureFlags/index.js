export const FEATURE_FLAG_DEFAULTS = Object.freeze({
    align: true, // toggle alignment of image highlighting to prevent or show overlapping
    type: 'keyword-dates' // search mode: keyword, keyword-dates, semantic, hybrid, or hybrid-dates
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
 * Parses a query-string string feature flag value.
 *
 * Returns the trimmed string value when provided, otherwise undefined.
 *
 * @param {unknown} value - Raw query-string value.
 * @param {readonly string[] | undefined} allowedValues - Optional allowlist; if omitted any non-empty string is accepted.
 * @returns {string | undefined} Matched value when valid, otherwise undefined.
 */
export function parseEnumFlagValue(value, allowedValues) {
    const flagValue = Array.isArray(value) ? value.at(-1) : value;

    if (typeof flagValue !== 'string') {
        return undefined;
    }

    const normalized = flagValue.trim().toLowerCase();
    if (!normalized) return undefined;
    return allowedValues === undefined || allowedValues.includes(normalized)
        ? normalized
        : undefined;
}

/**
 * Resolves a feature flag value from session state, with repo defaults.
 *
 * @param {import('express-session').Session | undefined} session - Request session object.
 * @param {'align' | 'type'} flagName - Supported feature flag name.
 * @returns {boolean | string} The active feature flag value.
 */
export function getFeatureFlagValue(session, flagName) {
    const sessionFlagValue = session?.featureFlags?.[flagName];

    if (typeof sessionFlagValue === 'boolean' || typeof sessionFlagValue === 'string') {
        return sessionFlagValue;
    }

    return FEATURE_FLAG_DEFAULTS[flagName];
}

/**
 * Persists supported feature flags from query-string params into the session.
 *
 * Boolean flags (`align`) accept `on` / `off` query-string values.
 * String flags (`type`) accept any non-empty string query-string value.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function featureFlags(req, res, next) {
    const flags = {};

    if (req.session) {
        for (const flagName of Object.keys(FEATURE_FLAG_DEFAULTS)) {
            flags[flagName] = getFeatureFlagValue(req.session, flagName);

            if (typeof FEATURE_FLAG_DEFAULTS[flagName] === 'boolean') {
                const queryFlagValue = parseFeatureFlagValue(req.query?.[flagName]);
                if (typeof queryFlagValue === 'boolean') {
                    flags[flagName] = queryFlagValue;
                }
            } else {
                const queryFlagValue = parseEnumFlagValue(req.query?.[flagName]);
                if (typeof queryFlagValue === 'string') {
                    flags[flagName] = queryFlagValue;
                }
            }
        }
        req.session.featureFlags = flags;
        res.locals.featureFlags = flags;
    }
    next();
}
