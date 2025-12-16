/**
 * Express middleware that ensures the 'crn' query parameter is present in GET requests.
 * If a case is selected in the session but 'crn' is not in the query string,
 * redirects to the same URL with 'crn' added from the session.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 */
function ensureCrnIsInQueryParameters(req, res, next) {
    if (req.method === 'GET') {
        if (req?.session?.caseSelected === true) {
            // we know it is a valid CRN from the `getCaseReferenceNumberFromQueryString` middleware.
            if (!req.query?.crn) {
                const newQuery = {
                    ...req.query,
                    crn: req.session.caseReferenceNumber
                };
                delete newQuery.caseReferenceNumber;

                const queryString = new URLSearchParams(newQuery).toString();
                return res.redirect(`${req.baseUrl}?${queryString}`);
            }
        }
    }
    next();
}

export default ensureCrnIsInQueryParameters;
