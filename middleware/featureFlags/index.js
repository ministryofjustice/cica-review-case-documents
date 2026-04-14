export const FEATURE_FLAG_DEFAULTS = Object.freeze({
    align: true, // toggle alignment of image highlighting to prevent or show overlapping
    hybrid: false, // toggle hybrid search on and off
    type: 'keyword' // search type: 'keyword', 'semantic', or 'all'
});

export const FEATURE_FLAG_ENUM_OPTIONS = Object.freeze({
    type: Object.freeze(['keyword', 'semantic', 'all'])
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
 * @param {'align' | 'hybrid' | 'type'} flagName - Supported feature flag name.
 * @returns {boolean | string} The active feature flag value.
 */
export function getFeatureFlagValue(session, flagName) {
    const sessionFlagValue = session?.featureFlags?.[flagName];

    if (flagName in FEATURE_FLAG_ENUM_OPTIONS) {
        if (FEATURE_FLAG_ENUM_OPTIONS[flagName].includes(sessionFlagValue)) {
            return sessionFlagValue;
        }
        return FEATURE_FLAG_DEFAULTS[flagName];
    }

    if (typeof sessionFlagValue === 'boolean') {
        return sessionFlagValue;
    }

    return FEATURE_FLAG_DEFAULTS[flagName];
}

/**
 * Persists supported feature flags from query-string params into the session.
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

            if (flagName in FEATURE_FLAG_ENUM_OPTIONS) {
                const queryFlagValue = parseEnumFlagValue(
                    req.query?.[flagName],
                    FEATURE_FLAG_ENUM_OPTIONS[flagName]
                );
                if (queryFlagValue !== undefined) {
                    flags[flagName] = queryFlagValue;
                }
            } else {
                const queryFlagValue = parseFeatureFlagValue(req.query?.[flagName]);
                if (typeof queryFlagValue === 'boolean') {
                    flags[flagName] = queryFlagValue;
                }
            }
        }
        req.session.featureFlags = flags;
        res.locals.featureFlags = flags;
    }
    next();
}
