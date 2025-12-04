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
function authenticateJWTToken(req, res, next) {
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

export default authenticateJWTToken;
