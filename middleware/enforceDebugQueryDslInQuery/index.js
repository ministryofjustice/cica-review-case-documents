import { getQueryDslOverrides } from '../debugVariables/index.js';

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
 * Ensures query DSL tuning values in session are present in URL query params.
 * Mirrors feature-flag URL persistence so tuning state remains bookmarkable and visible.
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

    // Only persist tuning values when debug mode is enabled.
    if (req.session?.featureFlags?.debug !== true) {
        return next();
    }

    const queryDslOverrides = getQueryDslOverrides(req.session?.debugVariables || {});

    const paramsToAdd = Object.entries(queryDslOverrides).filter(
        ([key]) => req.query[key] === undefined
    );

    if (paramsToAdd.length === 0) {
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
        const err = new Error('Redirect not allowed for this path');
        err.status = 400;
        return next(err);
    }

    const newQuery = { ...req.query };
    for (const [key, value] of paramsToAdd) {
        newQuery[key] = String(value);
    }

    const queryString = new URLSearchParams(newQuery).toString();
    return res.redirect(`${safePath}?${queryString}`);
}
