import { resolveSearchType } from '../../api/search/constants/searchTypes.js';
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

    // Determine canonical search type: use resolved value if provided (even if
    // non-canonical), otherwise fall back to session/default when absent/empty.
    let searchType;
    if (Array.isArray(rawQueryType)) {
        // Canonicalize repeated params to resolved value
        searchType = resolvedType;
    } else if (typeof queryType === 'string' && queryType.trim().length > 0) {
        // Query value was provided (not absent/empty) - use the resolved canonical form
        searchType = resolvedType;
    } else {
        // Query value was absent or empty - fall back to session/default
        searchType = getFeatureFlagValue(req.session, 'type');
    }

    redirectQuery.set('type', searchType);

    // Reconstruct the redirect path from Express-parsed routing values rather than
    // forwarding req.originalUrl directly, which is raw user-controlled input.
    // req.baseUrl is set by Express based on the matched mount point; req.path is
    // the sub-path after that mount point. Combining them avoids taint from the
    // raw URL string while correctly preserving the effective request path.
    const safePath = req.baseUrl + req.path.replace(/\/$/, '');
    return res.redirect(`${safePath}?${redirectQuery.toString()}`);
}
