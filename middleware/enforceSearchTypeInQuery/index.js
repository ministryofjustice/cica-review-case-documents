import { DEFAULT_SEARCH_TYPE, resolveSearchType } from '../../api/search/constants/searchTypes.js';
import { getFeatureFlagValue } from '../featureFlags/index.js';

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
        const normalisedQueryType =
            typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : '';
        const resolved = resolveSearchType(req.query.type, req.session);
        // Only skip the redirect when the type in the URL was itself a recognised
        // value. If it was unrecognised, resolveSearchType falls back to the session
        // or default, and we still need to redirect to canonicalise the URL.
        if (normalisedQueryType && resolved === normalisedQueryType) {
            return next();
        }
    }

    const searchType = getFeatureFlagValue(req.session, 'type') || DEFAULT_SEARCH_TYPE;
    const redirectQuery = new URLSearchParams(req.query);
    redirectQuery.set('type', searchType);
    const currentPath = req.originalUrl.split('?')[0];
    return res.redirect(`${currentPath}?${redirectQuery.toString()}`);
}
