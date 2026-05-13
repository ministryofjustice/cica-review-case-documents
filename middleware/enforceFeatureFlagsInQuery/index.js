import { FEATURE_FLAG_DEFAULTS } from '../featureFlags/index.js';

/**
 * An array of allowed URL paths for which feature-flag enforcement applies.
 * @type {string[]}
 * @constant
 */
const ALLOWED_PATHS = ['/search'];

// /**
//  * An array of allowed URL patterns for which feature-flag enforcement applies.
//  * @type {RegExp[]}
//  * @constant
//  */
// const ALLOWED_PATH_PATTERNS = [
//     /^\/document\/[0-9a-fA-F-]{36}\/view\/page\/\d+$/,
//     /^\/document\/[0-9a-fA-F-]{36}\/page\/\d+$/ // Image streaming endpoint
// ];

/**
 * Paths that should be excluded from feature-flag enforcement (static assets, etc.)
 * @type {RegExp[]}
 * @constant
 */
const EXCLUDED_PATHS = [
    /^\/favicon\.ico$/,
    /^\/public\//,
    /^\/js\//,
    /^\/stylesheets\//,
    /^\/assets\//,
    /^\/\.well-known\//
];

/**
 * Serialises a feature-flag session value to its query-string representation.
 *
 * Boolean flags are encoded as `on` / `off`; string flags are passed through as-is.
 *
 * @param {boolean | string} value - The session flag value.
 * @returns {string} The query-string representation.
 */
function serializeFlagValue(value) {
    if (typeof value === 'boolean') return value ? 'on' : 'off';
    return String(value);
}

/**
 * Middleware to ensure that non-default feature flags are present as query parameters
 * on GET requests. If a session flag differs from its default value and is absent from
 * the current query string, the request is redirected with the missing flags appended.
 *
 * This mirrors the behaviour of `enforceCrnInQuery` and allows non-default feature-flag
 * state to be visible in (and bookmarkable from) the URL.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
const enforceFeatureFlagsInQuery = (req, res, next) => {
    // Skip enforcement for excluded paths (static assets, favicon, etc.)
    if (EXCLUDED_PATHS.some((pattern) => pattern.test(req.path))) {
        return next();
    }

    // Only enforce on GET requests that already have session flags set
    if (req.method !== 'GET' || !req.session?.featureFlags) {
        return next();
    }

    const sessionFlags = req.session.featureFlags;

    // Find non-default flags that are absent from the current query string
    const flagsToAdd = Object.entries(sessionFlags).filter(
        ([key, val]) => val !== FEATURE_FLAG_DEFAULTS[key] && req.query[key] === undefined
    );

    if (flagsToAdd.length === 0) return next();

    // Harden: reject unsafe paths before attempting a redirect
    if (
        typeof req.path !== 'string' ||
        req.path.includes('//') ||
        req.path.includes('\\') ||
        req.path.includes('..') ||
        req.path.startsWith('http://') ||
        req.path.startsWith('https://')
    ) {
        const err = new Error('Invalid redirect path');
        err.status = 400;
        return next(err);
    }

    const normalizedPath = req.path.replace(/\/+$/, '');

    let safePath;
    if (ALLOWED_PATHS.includes(normalizedPath)) {
        safePath = normalizedPath;
    }
    // else {
    //     for (const pattern of ALLOWED_PATH_PATTERNS) {
    //         if (pattern.test(normalizedPath)) {
    //             safePath = normalizedPath;
    //             break;
    //         }
    //     }
    // }

    if (!safePath) {
        const err = new Error('Redirect not allowed for this path');
        err.status = 400;
        return next(err);
    }

    const newQuery = { ...req.query };
    for (const [key, val] of flagsToAdd) {
        newQuery[key] = serializeFlagValue(val);
    }

    const queryString = new URLSearchParams(newQuery).toString();
    return res.redirect(`${safePath}?${queryString}`);
};

export { /* ALLOWED_PATH_PATTERNS, */ ALLOWED_PATHS, EXCLUDED_PATHS };
export default enforceFeatureFlagsInQuery;
