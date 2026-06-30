import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/apiJwtClaims/index.js';

/**
 * Extracts a bearer token from the Authorization header.
 */
function getTokenFromRequest(req) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return null;
    }

    // Must follow: "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    return token;
}

/**
 * Middleware to authenticate JWT tokens from Authorization headers.
 * If a valid token is found, attaches the decoded token object to `req.decodedToken`.
 * Responds with 401 if no token is provided, or 403 if the token is invalid.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function authenticateJWTToken(req, res, next) {
    if (req.apiJwtVerified === true && req.decodedToken) {
        return next();
    }

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

    let jwtVerificationOptions;
    try {
        if (!process.env.APP_JWT_SECRET) {
            throw new Error('APP_JWT_SECRET environment variable is not set');
        }

        jwtVerificationOptions = {
            algorithms: ['HS256'],
            issuer: getApiJwtIssuer(),
            audience: getApiJwtAudience()
        };
    } catch (err) {
        req.log?.error(
            { url: req.originalUrl, error: err.message },
            'JWT authentication configuration error'
        );
        return res.status(500).json({
            errors: [
                {
                    status: '500',
                    title: 'Internal Server Error',
                    detail: 'Authentication service is not configured correctly'
                }
            ]
        });
    }

    try {
        // Verify the token and attach the decoded payload to the request object for downstream middleware and route handlers.
        req.decodedToken = jwt.verify(token, process.env.APP_JWT_SECRET, jwtVerificationOptions);
        const rawIdentity = req.decodedToken?.id;
        const identity = typeof rawIdentity === 'string' ? rawIdentity.trim() : rawIdentity;

        // if (typeof rawIdentity === 'string') {
        //     req.decodedToken.id = identity;
        // }
        if (identity == null || identity === '') {
            req.log?.warn(
                { url: req.originalUrl },
                'Authentication token is missing a usable identity claim'
            );
            return res.status(403).json({
                errors: [
                    {
                        status: '403',
                        title: 'Forbidden',
                        detail: 'Authentication token is missing required identity claims'
                    }
                ]
            });
        }
        req.decodedToken.id = identity;
        req.apiJwtVerified = true;
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
