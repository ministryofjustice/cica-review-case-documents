const CRN_REGEX = /^\d{2}-[78]\d{5}$/;

/**
 * An array of allowed URL paths for which certain middleware logic applies.
 * @type {string[]}
 * @constant
 * @example
 * // Checks if '/search' is an allowed path
 * if (ALLOWED_PATHS.includes(request.path)) { ... }
 */
const ALLOWED_PATHS = ['/search'];
/**
 * An array of allowed URL patterns for which certain middleware logic applies.
 * @type {RegExp[]}
 * @constant
 * @example
 * // Checks if '/document/UUID/view/page/1' is an allowed pattern
 * if (ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(request.path))) { ... }
 */
const ALLOWED_PATH_PATTERNS = [
    /^\/document\/[0-9a-fA-F-]{36}\/view\/page\/\d+$/,
    /^\/document\/[0-9a-fA-F-]{36}\/page\/\d+$/ // Image streaming endpoint
];

/**
 * Paths that should be excluded from CRN enforcement (static assets, etc.)
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
 * Middleware to ensure that a `crn` query parameter is present on GET requests
 * if a case has been selected and is stored in the session. If the `crn` is
 * missing, it constructs a new URL with the `crn` from the session and redirects.
 *
 * This is primarily to ensure that bookmarked URLs or manual URL entries
 * work as expected when a user has an active case session.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const enforceCrnInQuery = (req, res, next) => {
    // Skip enforcement for excluded paths (static assets, favicon, etc.)
    if (EXCLUDED_PATHS.some((pattern) => pattern.test(req.path))) {
        return next();
    }

    if (req.method === 'GET' && req.session?.caseSelected === true && !req.query?.crn) {
        // Harden: Only allow safe relative paths (no //, no backslash, no protocol)
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

        let safePath;
        const normalizedPath = req.path.replace(/\/+$/, '');

        if (ALLOWED_PATHS.includes(normalizedPath)) {
            safePath = normalizedPath;
        } else {
            // For pattern-matched paths, re-match and reconstruct
            for (const pattern of ALLOWED_PATH_PATTERNS) {
                const match = normalizedPath.match(pattern);
                if (match) {
                    safePath = normalizedPath; // or reconstruct from match groups if needed
                    break;
                }
            }
        }

        if (!safePath) {
            const err = new Error('Redirect not allowed for this path');
            err.status = 400;
            return next(err);
        }

        // Validate CRN format: YY-7NNNNN or YY-8NNNNN
        // where YY = year, 7 = Personal Injury, 8 = Bereavement, NNNNN = 5-digit case ID
        const crn = req.session.caseReferenceNumber;
        if (!CRN_REGEX.test(crn)) {
            return res.status(400).send('Invalid case reference number');
        }

        const newQuery = {
            ...req.query,
            crn
        };
        // The original middleware may have picked up caseReferenceNumber from the query
        // we should remove it to avoid it being in the query string twice.
        delete newQuery.caseReferenceNumber;

        const queryString = new URLSearchParams(newQuery).toString();
        return res.redirect(`${safePath}?${queryString}`);
    }
    next();
};

export { ALLOWED_PATHS, ALLOWED_PATH_PATTERNS, EXCLUDED_PATHS };
export default enforceCrnInQuery;
