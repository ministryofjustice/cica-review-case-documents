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

    if (req.query.type !== undefined) {
           // Express parses repeated query params (e.g. ?type=a&type=b) as an array.
           // Use the last element in that case, consistent with parseFeatureFlagValue /
           // parseEnumFlagValue, so a valid trailing value is not silently discarded and
           // the user's intent is preserved in any subsequent redirect.
        const rawQueryType = Array.isArray(req.query.type)
            ? (req.query.type.at(-1) ?? '')
            : typeof req.query.type === 'string'
              ? req.query.type
              : '';
        const canonicalQueryType = rawQueryType.trim().toLowerCase();
        const resolved = resolveSearchType(req.query.type, req.session);
        // Only skip the redirect when the type in the URL is already in its
        // canonical form and is itself a recognised value. Non-canonical casing
        // or whitespace should still be redirected so the URL is canonicalised.
        if (
            rawQueryType &&
            rawQueryType === canonicalQueryType &&
            resolved === canonicalQueryType
        ) {
            return next();
        }
        // If the type is recognisable but not canonical (e.g. wrong case or
        // surrounding whitespace), redirect to the canonical form of the input
        // rather than falling back to the session/default.
        if (canonicalQueryType && resolved === canonicalQueryType) {
            const redirectQuery = new URLSearchParams(req.query);
            redirectQuery.set('type', canonicalQueryType);
            const currentPath = req.originalUrl.split('?')[0];
            return res.redirect(`${currentPath}?${redirectQuery.toString()}`);
        }
    }

    const searchType = resolveSearchType(req.session?.featureFlags?.type, req.session);
    const redirectQuery = new URLSearchParams(req.query);
    redirectQuery.set('type', searchType);
    const currentPath = req.originalUrl.split('?')[0];
    return res.redirect(`${currentPath}?${redirectQuery.toString()}`);
}
