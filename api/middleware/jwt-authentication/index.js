import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../../utils/apiJwtClaims.js';

/**
 * Extracts a bearer token from the Authorization header.
 */
function getTokenFromRequest(req) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) return null;

    // Must follow: "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return token;
}

/**
 * Middleware to authenticate JWT tokens from Authorization headers.
 * If a valid token is found, attaches the decoded user object to `req.user`.
 * Responds with 401 if no token is provided, or 403 if the token is invalid.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function authenticateJWTToken(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        req.log?.warn({ url: req.originalUrl }, 'Missing authentication token');
        return res.status(401).json({
            errors: [
                {
                    status: '401',
                    title: 'Unauthorized',
                    detail: 'Missing authentication token'
                }
            ]
        });
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: getApiJwtIssuer(),
            audience: getApiJwtAudience()
        });
        req.user = user;
        next();
    } catch (err) {
        req.log?.warn({ url: req.originalUrl, error: err.message }, 'Invalid authentication token');
        return res.status(403).json({
            errors: [
                {
                    status: '403',
                    title: 'Forbidden',
                    detail: 'Invalid authentication token'
                }
            ]
        });
    }
}

export default authenticateJWTToken;
