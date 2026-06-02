import { FEATURE_FLAG_DEFAULTS, getFeatureFlagValue } from '../featureFlags/index.js';

/**
 * An array of allowed URL paths for which feature-flag enforcement applies.
 * @type {string[]}
 * @constant
 */
const ALLOWED_PATHS = ['/search'];

/**
 * An array of allowed URL patterns for which feature-flag enforcement applies.
 * @type {RegExp[]}
 * @constant
 */
const ALLOWED_PATH_PATTERNS = [
    /^\/document\/[0-9a-fA-F-]{36}\/view\/page\/\d+$/,
    /^\/document\/[0-9a-fA-F-]{36}\/view\/text\/page\/\d+$/,
    /^\/document\/[0-9a-fA-F-]{36}\/page\/\d+$/ // Image streaming endpoint
];

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

const DOCUMENT_VIEW_PAGE_PATH_PATTERN = /^\/document\/([0-9a-fA-F-]{36})\/view\/page\/(\d+)$/;
const DOCUMENT_VIEW_TEXT_PAGE_PATH_PATTERN =
    /^\/document\/([0-9a-fA-F-]{36})\/view\/text\/page\/(\d+)$/;
const DOCUMENT_IMAGE_PAGE_PATH_PATTERN = /^\/document\/([0-9a-fA-F-]{36})\/page\/(\d+)$/;

/**
 * Serialises a feature-flag session value to its query-string representation.
 *
 * Boolean flags are encoded as `on` / `off`; string flags are passed through as-is.
 *
 * @param {boolean | string} value - The session flag value.
 * @returns {string} The query-string representation.
 */
function serializeFlagValue(value) {
    if (typeof value === 'boolean') {
        return value ? 'on' : 'off';
    }

    return String(value);
}

/**
 * Returns a canonical redirect path for supported routes.
 *
 * The returned path is rebuilt from regex-captured segments so redirects never
 * depend on raw, unsanitized request path input.
 *
 * @param {string} path - Request path to validate.
 * @returns {string | undefined} Canonical safe path when allowed.
 */
function resolveSafeRedirectPath(path) {
    const normalizedPath = path.replace(/\/+$/, '');

    if (ALLOWED_PATHS.includes(normalizedPath)) {
        return normalizedPath;
    }

    const viewPageMatch = normalizedPath.match(DOCUMENT_VIEW_PAGE_PATH_PATTERN);
    if (viewPageMatch) {
        const [, documentId, pageNumber] = viewPageMatch;
        return `/document/${documentId}/view/page/${pageNumber}`;
    }

    const viewTextPageMatch = normalizedPath.match(DOCUMENT_VIEW_TEXT_PAGE_PATH_PATTERN);
    if (viewTextPageMatch) {
        const [, documentId, pageNumber] = viewTextPageMatch;
        return `/document/${documentId}/view/text/page/${pageNumber}`;
    }

    const imagePageMatch = normalizedPath.match(DOCUMENT_IMAGE_PAGE_PATH_PATTERN);
    if (imagePageMatch) {
        const [, documentId, pageNumber] = imagePageMatch;
        return `/document/${documentId}/page/${pageNumber}`;
    }

    return undefined;
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

    // Find non-default supported flags that are absent from the current query string.
    // Unknown/stale session keys are ignored so only bookmarkable flags are reflected.
    const flagsToAdd = Object.keys(FEATURE_FLAG_DEFAULTS)
        .map((flagName) => [flagName, getFeatureFlagValue(req.session, flagName)])
        .filter(
            ([flagName, sessionFlagValue]) =>
                sessionFlagValue !== FEATURE_FLAG_DEFAULTS[flagName] &&
                req.query[flagName] === undefined
        );

    if (flagsToAdd.length === 0) {
        return next();
    }

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

    const safePath = resolveSafeRedirectPath(req.path);

    if (!safePath) {
        const err = new Error('Redirect not allowed for this path');
        err.status = 400;
        return next(err);
    }

    const newQuery = { ...req.query };
    for (const [flagName, sessionFlagValue] of flagsToAdd) {
        newQuery[flagName] = serializeFlagValue(sessionFlagValue);
    }

    const queryString = new URLSearchParams(newQuery).toString();
    return res.redirect(`${safePath}?${queryString}`);
};

export { ALLOWED_PATH_PATTERNS, ALLOWED_PATHS, EXCLUDED_PATHS };
export default enforceFeatureFlagsInQuery;
