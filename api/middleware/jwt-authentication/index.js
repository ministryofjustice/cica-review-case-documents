import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/apiJwtClaims/index.js';

/**
 * Resolves the JWT authentication configuration from the environment.
 * Called once when the middleware is created so that request handling does
 * not read mutable global state (process.env) on every invocation.
 *
 * @returns {{ secret: string|undefined, issuer: string, audience: string }} Resolved config.
 */
function resolveJwtConfigFromEnv() {
    return {
        secret: process.env.APP_JWT_SECRET,
        issuer: getApiJwtIssuer(),
        audience: getApiJwtAudience()
    };
}

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
 * Creates JWT authentication middleware with its configuration resolved once,
 * up front, rather than read from process.env on every request.
 *
 * Configuration can be injected directly (preferred, and used by tests), or
 * resolved from the environment when omitted (the default used by app wiring).
 * If required configuration is missing, the resulting middleware responds with
 * 500 for every request, preserving the previous "misconfigured service"
 * behaviour without reading global state per request.
 *
 * The `config` object as a whole is optional: omit it to resolve everything
 * from the environment. When `config` IS provided it is treated as the complete
 * configuration and is NOT merged with the environment; `secret`, `issuer` and
 * `audience` are all required together. A partial config (a missing field)
 * yields a middleware that responds with 500, rather than silently sourcing the
 * missing field from `process.env` — mixing injected and environment values at
 * an auth boundary is intentionally disallowed.
 *
 * @param {Object} [config] - Complete JWT config, or omit to resolve from env.
 * @param {string} config.secret - HMAC secret used to verify tokens (required when `config` is given).
 * @param {string} config.issuer - Expected token issuer (required when `config` is given).
 * @param {string} config.audience - Expected token audience (required when `config` is given).
 * @returns {import('express').RequestHandler} The configured middleware.
 */
export function createAuthenticateJWTToken(config) {
    let resolved;
    let configError;

    try {
        resolved = config ?? resolveJwtConfigFromEnv();
        if (!resolved.secret) {
            throw new Error('APP_JWT_SECRET environment variable is not set');
        }
        if (!resolved.issuer) {
            throw new Error('APP_API_JWT_ISSUER environment variable is not set');
        }
        if (!resolved.audience) {
            throw new Error('APP_API_JWT_AUDIENCE environment variable is not set');
        }
    } catch (err) {
        configError = err;
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
    return function authenticateJWTToken(req, res, next) {
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

        if (configError) {
            req.log?.error(
                { url: req.originalUrl, error: configError.message },
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

        const jwtVerificationOptions = {
            algorithms: ['HS256'],
            issuer: resolved.issuer,
            audience: resolved.audience
        };

        try {
            // Verify the token and attach the decoded payload to the request object for downstream middleware and route handlers.
            req.decodedToken = jwt.verify(token, resolved.secret, jwtVerificationOptions);
            const rawIdentity = req.decodedToken?.id;
            const identity = typeof rawIdentity === 'string' ? rawIdentity.trim() : rawIdentity;

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
            req.log?.warn(
                { url: req.originalUrl, error: err.message },
                'Invalid authentication token'
            );
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
    };
}

export default createAuthenticateJWTToken;
