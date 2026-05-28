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

    const rawQueryType = req.query.type;

    // Express parses repeated query params (e.g. ?type=a&type=b) as an array.
    // Normalize to the last entry first, consistent with parseFeatureFlagValue /
    // parseEnumFlagValue.
    const queryType = Array.isArray(rawQueryType) ? rawQueryType.at(-1) : rawQueryType;

    const resolvedType = resolveSearchType(queryType, req.session);

    // Only skip the redirect when the query value is already the exact canonical
    // form. Anything absent, invalid, or messy (wrong case, whitespace) is
    // redirected to the resolved value from the session or app default.
    if (!Array.isArray(rawQueryType) && queryType === resolvedType) {
        return next();
    }

    const redirectQuery = new URLSearchParams(req.query);

    // Keep historical behaviour for single values (fallback from session/default),
    // but canonicalize repeated params to one resolved value so downstream
    // middleware sees a string type rather than an array.
    const searchType = Array.isArray(rawQueryType)
        ? resolvedType
        : resolveSearchType(req.session?.featureFlags?.type, req.session);

    redirectQuery.set('type', searchType);
    const currentPath = req.originalUrl.split('?')[0];
    return res.redirect(`${currentPath}?${redirectQuery.toString()}`);
}
