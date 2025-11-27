/**
 * Middleware to check if the user is authenticated.
 *
 * This function first checks for a session-based login (for backward compatibility).
 * If not found, it checks for a JWT token in cookies or the Authorization header.
 * If a valid token is found, it attaches the decoded user object to `req.user` and calls `next()`.
 * If authentication fails, it logs a warning, saves the original URL to the session,
 * and redirects the user to the login page.
 */
import jwt from 'jsonwebtoken';

/**
 * Middleware to check if the user is authenticated.
 *
 * This function first checks for a session-based login (for backward compatibility).
 * If not found, it checks for a JWT token in cookies or the Authorization header.
 * If a valid token is found, it attaches the decoded user object to `req.user` and calls `next()`.
 * If authentication fails, it logs a warning, saves the original URL to the session,
 * and redirects the user to the login page.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function isAuthenticated(req, res, next) {
    // Check session first (for backward compatibility)
    if (req.session?.loggedIn) {
        return next();
    }

    // Check JWT cookie
    const token =
        req.cookies.jwtToken ||
        (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        req.log?.warn({ url: req.originalUrl }, 'Missing authentication token');
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET);
        req.user = user;
        return next();
    } catch (err) {
        req.log?.warn({ url: req.originalUrl, error: err.message }, 'Invalid authentication token');
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }
}
