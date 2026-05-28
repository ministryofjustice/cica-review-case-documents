import { resolveSearchType } from '../../api/search/constants/searchTypes.js';

/**
 * Middleware that ensures a `type` query parameter is always present on GET /search requests.
 *
 * When `type` is absent or invalid in the query string the resolved search type (from the
 * session, falling back to the application default) is appended and the browser is redirected.
 * This keeps the URL canonical and bookmarkable without route handlers needing to
 * duplicate the logic. The redirect preserves the current request path so it can be
 * mounted at a route or app layer.
 *
 * Applies only to GET requests; POST requests are passed through unchanged.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function enforceSearchTypeInQuery(req, res, next) {
    if (req.method !== 'GET') {
        return next();
    }

    // Express parses repeated query params (e.g. ?type=a&type=b) as an array.
    // Use the last element in that case, consistent with parseFeatureFlagValue /
    // parseEnumFlagValue, so a valid trailing value is not silently discarded.
    const queryType = Array.isArray(req.query.type) ? req.query.type.at(-1) : req.query.type;

    const resolved = resolveSearchType(queryType, req.session);

    // Only skip the redirect when the query value is already the exact canonical
    // form. Anything absent, invalid, or messy (wrong case, whitespace) is
    // redirected to the resolved value from the session or app default.
    if (queryType === resolved) {
        return next();
    }

    // For the redirect, resolve from the session value directly so that a valid
    // session type is used as the fallback rather than always defaulting to the
    // app default. resolveSearchType(undefined, session) skips the session lookup
    // and returns DEFAULT_SEARCH_TYPE immediately, so we pass the session value
    // explicitly here.
    const searchType = resolveSearchType(req.session?.featureFlags?.type, req.session);
    const redirectQuery = new URLSearchParams(req.query);
    redirectQuery.set('type', searchType);
    const currentPath = req.originalUrl.split('?')[0];
    return res.redirect(`${currentPath}?${redirectQuery.toString()}`);
}
