/**
 * Middleware to check if a case has been selected in the session.
 * If not, redirects the user to the '/case' route.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 */
const caseSelected = (req, res, next) => {
    if (req?.session?.caseSelected !== true) {
        return res.redirect('/case');
    }
    next();
};

export { caseSelected };
