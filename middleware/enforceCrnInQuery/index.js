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
        const newQuery = {
            ...req.query,
            crn: req.session.caseReferenceNumber
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
