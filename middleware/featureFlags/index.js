import SEARCH_TYPES, {
    DEFAULT_SEARCH_TYPE,
    resolveSearchType
} from '../../api/search/constants/searchTypes.js';

export const FEATURE_FLAG_DEFAULTS = Object.freeze({
    align: true, // toggle alignment of image highlighting to prevent or show overlapping
    type: DEFAULT_SEARCH_TYPE, // search mode: keyword, keyword-dates, semantic, hybrid, or hybrid-dates
    debug: false // toggle debug panel showing diagnostic info, DSL, feature flags, etc.
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
 * Resolves where a feature flag value originated from.
 *
 * When the middleware persists default values into the session, this function
 * treats values equal to the defaults as 'default' source, not 'session'.
 * This ensures the debug panel's origin indicator reflects the actual source
 * of a user-set override, not just whether a value exists in the session.
 *
 * @param {import('express-session').Session | undefined} session - Request session object.
 * @param {'align' | 'type' | 'debug'} flagName - Supported feature flag name.
 * @returns {'default' | 'session'} Source of the resolved value.
 */
export function getFeatureFlagSource(session, flagName) {
    const sessionFlagValue = session?.featureFlags?.[flagName];
    const defaultValue = FEATURE_FLAG_DEFAULTS[flagName];

    if (flagName === 'type') {
        if (typeof sessionFlagValue === 'string') {
            const normalisedSessionType = sessionFlagValue.trim().toLowerCase();
            if (Object.values(SEARCH_TYPES).includes(normalisedSessionType)) {
                // Treat persisted defaults as originating from 'default', not 'session'
                return normalisedSessionType === defaultValue ? 'default' : 'session';
            }
        }
        return 'default';
    }

    if (typeof defaultValue === 'boolean') {
        if (typeof sessionFlagValue === 'boolean') {
            // Treat persisted defaults as originating from 'default', not 'session'
            return sessionFlagValue === defaultValue ? 'default' : 'session';
        }
        return 'default';
    }

    if (typeof defaultValue === 'string') {
        if (typeof sessionFlagValue === 'string') {
            // Treat persisted defaults as originating from 'default', not 'session'
            return sessionFlagValue === defaultValue ? 'default' : 'session';
        }
        return 'default';
    }

    return 'default';
}

/**
 * Resolves a feature flag value from session state, with repo defaults.
 *
 * @param {import('express-session').Session | undefined} session - Request session object.
 * @param {'align' | 'type' | 'debug'} flagName - Supported feature flag name.
 * @returns {boolean | string} The active feature flag value.
 */
export function getFeatureFlagValue(session, flagName) {
    if (flagName === 'debug' && process.env.DEPLOY_ENV === 'production') {
        return false;
    }
    const sessionFlagValue = session?.featureFlags?.[flagName];
    const defaultValue = FEATURE_FLAG_DEFAULTS[flagName];

    if (flagName === 'type') {
        return resolveSearchType(sessionFlagValue, session);
    }

    // Validate the session value matches the expected type for this flag.
    // Boolean flags like 'align' and 'debug' should only accept booleans; string flags like 'type'
    // should only accept strings. Stale/corrupt sessions with mismatched types fall back
    // to the default.
    if (typeof defaultValue === 'boolean') {
        // align flag expects a boolean
        if (typeof sessionFlagValue === 'boolean') {
            return sessionFlagValue;
        }
    } else if (typeof defaultValue === 'string') {
        // type flag expects a string
        if (typeof sessionFlagValue === 'string') {
            return sessionFlagValue;
        }
    }

    return defaultValue;
}

/**
 * Persists supported feature flags from query-string params into the session.
 *
 * Boolean flags (`align`) accept `on` / `off` query-string values.
 * The `type` flag is resolved to a supported search type. Unrecognised values fall back to
 * the current session value or the default search type.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function featureFlags(req, res, next) {
    const flags = {};
    const provenance = {};

    if (req.session) {
        for (const flagName of Object.keys(FEATURE_FLAG_DEFAULTS)) {
            // Initialize from validated session values with repo defaults.
            flags[flagName] = getFeatureFlagValue(req.session, flagName);
            provenance[flagName] = getFeatureFlagSource(req.session, flagName);

            if (typeof FEATURE_FLAG_DEFAULTS[flagName] === 'boolean') {
                const queryFlagValue = parseFeatureFlagValue(req.query?.[flagName]);
                // Block query-string override for debug flag in production
                if (
                    typeof queryFlagValue === 'boolean' &&
                    !(flagName === 'debug' && process.env.DEPLOY_ENV === 'production')
                ) {
                    flags[flagName] = queryFlagValue;
                    provenance[flagName] = 'query';
                }
            } else if (flagName === 'type') {
                // Express parses repeated query params (e.g. ?type=a&type=b) as an array.
                // Normalize to the last entry first, consistent with parseFeatureFlagValue /
                // parseEnumFlagValue.
                const queryType = Array.isArray(req.query?.type)
                    ? req.query.type.at(-1)
                    : req.query?.type;

                if (typeof queryType === 'string' && queryType.trim().length > 0) {
                    // Only process a non-empty type value. An empty or whitespace-only
                    // ?type= query param is treated as absent so the session value is preserved.
                    const normalizedQueryType = queryType.trim().toLowerCase();
                    if (Object.values(SEARCH_TYPES).includes(normalizedQueryType)) {
                        flags[flagName] = normalizedQueryType;
                        provenance[flagName] = 'query';
                    } else {
                        flags[flagName] = resolveSearchType(queryType, req.session);
                    }
                }
            } else {
                const queryFlagValue = parseEnumFlagValue(req.query?.[flagName]);
                if (typeof queryFlagValue === 'string') {
                    flags[flagName] = queryFlagValue;
                    provenance[flagName] = 'query';
                }
            }
        }
        // Only update the session if there are changes to prevent unnecessary
        // session writes and churn in session stores.
        const existingFlags = req.session.featureFlags || {};
        const hasStaleKeys = Object.keys(existingFlags)
            .some((key) => !(key in FEATURE_FLAG_DEFAULTS));
        const hasChanges = hasStaleKeys ||
            Object.keys(FEATURE_FLAG_DEFAULTS).some(
                (key) => existingFlags[key] !== flags[key]
            );
        if (hasChanges) {
            req.session.featureFlags = flags;
        }

        res.locals.featureFlags = flags;
        res.locals.featureFlagProvenance = provenance;
    }
    next();
}
