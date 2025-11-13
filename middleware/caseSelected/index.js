/**
 * Middleware to verify that a case has been selected in the current session.
 *
 * If the session does not indicate that a case has been selected (`req.session.caseSelected !== true`),
 * the user is redirected to the `/case` page. Otherwise, control is passed to the next middleware
 * or route handler.
 *
 * @example
 * // Example usage in an Express app:
 * app.get('/case-details', caseSelected, (req, res) => {
 *   res.render('case-details', { caseReferenceNumber: req.session.caseReferenceNumber });
 * });
 *
 * @param {import('express').Request} req - The Express request object. Must contain a `session` object with a `caseSelected` property.
 * @param {import('express').Response} res - The Express response object, used to redirect if no case is selected.
 * @param {import('express').NextFunction} next - The Express `next` function to pass control to the next middleware.
 * @returns {void} Does not return a value; either redirects the response or calls `next()`.
 */
const caseSelected = (req, res, next) => {
    if (req?.session?.caseSelected !== true) {
        return res.redirect('/case');
    }
    next();
};

export { caseSelected };
