/**
 * Express middleware to authenticate JWT tokens from cookies or Authorization header.
 *
 * Checks for a JWT token in the `jwtToken` cookie or in the `Authorization` header.
 * If a valid token is found, attaches the decoded user object to `req.user` and calls `next()`.
 * If no token is found, responds with 401 Unauthorized.
 * If the token is invalid, responds with 403 Forbidden.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
import jwt from 'jsonwebtoken';

/**
 * Middleware to authenticate JWT tokens from cookies or Authorization headers.
 * If a valid token is found, attaches the decoded user object to `req.user`.
 * Responds with 401 if no token is provided, or 403 if the token is invalid.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function authenticateToken(req, res, next) {
    const token =
        req.cookies.jwtToken ||
        (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        req.log?.warn({ url: req.originalUrl }, 'Missing authentication token');
        return res.status(401).send('Missing authentication token');
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        req.log?.warn({ url: req.originalUrl, error: err.message }, 'Invalid authentication token');
        return res.status(403).send('Invalid authentication token');
    }
}

export default authenticateToken;
