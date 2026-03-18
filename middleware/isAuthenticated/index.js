/**
 * Middleware to check if the user is authenticated.
 *
 * This function checks for a session-based login.
 * If authentication fails, it logs a warning, saves the original URL to the session,
 * and redirects the user to the login page.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function isAuthenticated(req, res, next) {
    // Only check session for UI/browser authentication
    if (req.session?.loggedIn) {
        return next();
    }
    req.log?.warn({ url: req.originalUrl }, 'Missing session authentication');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
}
