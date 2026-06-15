import { getQueryDslOverrides, parseDebugVariablesFromQuery } from '../debugVariables/index.js';

const ALLOWED_PATHS = ['/search'];

const DOCUMENT_VIEW_PAGE_PATH_PATTERN = /^\/document\/([0-9a-fA-F-]{36})\/view\/page\/(\d+)$/;
const DOCUMENT_VIEW_TEXT_PAGE_PATH_PATTERN =
    /^\/document\/([0-9a-fA-F-]{36})\/view\/text\/page\/(\d+)$/;
const DOCUMENT_IMAGE_PAGE_PATH_PATTERN = /^\/document\/([0-9a-fA-F-]{36})\/page\/(\d+)$/;

const EXCLUDED_PATHS = [
    /^\/favicon\.ico$/,
    /^\/public\//,
    /^\/js\//,
    /^\/stylesheets\//,
    /^\/assets\//,
    /^\/\.well-known\//
];

/**
 * Returns a canonical redirect path for supported routes, rebuilt from regex-captured
 * segments so redirects never depend on raw unsanitized request path input.
 *
 * @param {string} path - Request path to validate.
 * @returns {string | undefined} Canonical safe path when allowed, otherwise undefined.
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
 * Builds a redirect query string while preserving repeated query parameters.
 *
 * Express can provide array-valued query entries for repeated params
 * (e.g. `?x=a&x=b` -> `{ x: ['a', 'b'] }`). Appending each value keeps
 * semantics intact instead of collapsing to `x=a,b`.
 *
 * @param {Record<string, unknown>} query - Query object.
 * @returns {string} Encoded query string.
 */
function buildRedirectQueryString(query) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                searchParams.append(key, String(item));
            });
            continue;
        }

        searchParams.append(key, String(value));
    }

    return searchParams.toString();
}


/**
 * Ensures query DSL tuning values in session are present and valid in URL query params.
 * Mirrors feature-flag URL persistence so tuning state remains bookmarkable and visible.
 *
 * This middleware catches both missing values and invalid values that failed validation,
 * redirecting to sync the URL with the effective session configuration.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function enforceDebugQueryDslInQuery(req, res, next) {
    if (EXCLUDED_PATHS.some((pattern) => pattern.test(req.path))) {
        return next();
    }

    if (req.method !== 'GET') {
        return next();
    }

    // Only persist tuning values when debug mode is enabled via validated feature flags.
    if (res?.locals?.featureFlags?.debug !== true) {
        return next();
    }

    const sessionQueryDslOverrides = getQueryDslOverrides(req.session?.debugVariables || {});

    // Parse and validate query params the same way debugVariablesMiddleware does.
    // This catches both missing values AND invalid values that fail validation.
    const parsedQueryDslOverrides = parseDebugVariablesFromQuery(req.query);

    // Determine if any DSL params need correction:
    // - Missing/empty values that should be filled from session
    // - Invalid values that were rejected and should be replaced with session values
    const paramsToCorrect = Object.entries(sessionQueryDslOverrides).filter(
        ([key, sessionValue]) => {
            const queryValue = parsedQueryDslOverrides[key];
            // Redirect if: value is missing from parsed (invalid or empty in query),
            // OR value differs from session (invalid input was sanitized)
            return queryValue === undefined || queryValue !== sessionValue;
        }
    );

    if (paramsToCorrect.length === 0) {
        return next();
    }

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
        // For unknown/non-allowlisted routes, skip enforcement and let normal
        // routing (including 404 handling) proceed.
        return next();
    }

    const newQuery = { ...req.query };
    for (const [key, value] of paramsToCorrect) {
        newQuery[key] = String(value);
    }

    const queryString = buildRedirectQueryString(newQuery);
    return res.redirect(`${safePath}?${queryString}`);
}
