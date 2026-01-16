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
            return res.status(400).send('Invalid redirect path');
        }

        // Harden: Only allow alphanumeric crn (adjust regex as needed for your use case)
        const crn = req.session.caseReferenceNumber;
        if (!/^[a-zA-Z0-9-]+$/.test(crn)) {
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
        // req.path will preserve the path at which the middleware is mounted.
        return res.redirect(`${req.path}?${queryString}`);
    }
    next();
};

export default enforceCrnInQuery;
