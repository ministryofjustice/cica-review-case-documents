/**
 * Express middleware for dynamic rate limiting based on authentication status.
 *
 * - Authenticated users have a higher request limit than unauthenticated users.
 * - Limits and window duration are configurable via environment variables:
 *   - API_RATE_LIMIT_MAX_AUTH: Max requests for authenticated users (default: 1000)
 *   - API_RATE_LIMIT_MAX_UNAUTH: Max requests for unauthenticated users (default: 50)
 *   - API_RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - Uses user ID as the key for authenticated users, IP address otherwise.
 * - Rate limiting is only enforced in production environments.
 * - Responds with HTTP 429 and a JSON error message when the limit is exceeded.
 *
 * @module middleware/rateLimiter
 * @type {import('express').RequestHandler}
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/apiJwtClaims/index.js';
import normalizeApiJwtUser from '../utils/normalizeApiJwtUser.js';

/**
 * Default rate limit window duration in milliseconds (15 minutes).
 *
 * @type {number}
 */
const WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

/**
 * Returns the Bearer token from the Authorization header if present and well-formed.
 *
 * @param {*} req - Express request object
 * @returns {*} - The Bearer token string if present and valid, or null if not found or malformed
 */
function getBearerToken(req) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return null;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    return token;
}

/**
 * Checks if the request has a valid API JWT token.
 *
 * @param {*} req - Express request object
 * @returns {boolean} - True if the request has a valid API JWT token, false otherwise
 */
function hasValidApiJwt(req) {
    const token = getBearerToken(req);
    if (!token || !process.env.APP_JWT_SECRET) {
        return false;
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: getApiJwtIssuer(),
            audience: getApiJwtAudience()
        });

        req.user = normalizeApiJwtUser(user);
        if (req.user?.id == null || req.user.id === '') {
            return false;
        }
        req.apiJwtVerified = true; // marker for auth middleware short-circuit
        return true;
    } catch {
        return false;
    }
}

/**
 * Rate limiter for unauthenticated API requests.
 *
 * @type {*} - Express middleware that applies a stricter rate limit to unauthenticated requests.
 * Authenticated requests (with a valid API JWT) are not subject to this limiter.
 * The limit and window duration are configurable via environment variables.
 * Responds with HTTP 429 and a JSON error message when the limit is exceeded.
 */
const unauthenticatedApiRateLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: () => Number(process.env.API_RATE_LIMIT_MAX_UNAUTH) || 50,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    skip: (req) => process.env.NODE_ENV !== 'production' || hasValidApiJwt(req),
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

/**
 * Dynamic rate limiter for API requests based on authentication status.
 *
 * @type {*} - Express middleware that applies different rate limits for authenticated and unauthenticated requests.
 * Authenticated requests (with a valid API JWT) have a higher limit than unauthenticated requests.
 * The limits and window duration are configurable via environment variables.
 * Responds with HTTP 429 and a JSON error message when the limit is exceeded.
 */
const dynamicRateLimiter = rateLimit({
    windowMs: WINDOW_MS,
    // Evaluate limits at request time to allow test changes
    limit: (req, res) => {
        const authenticatedLimit = Number(process.env.API_RATE_LIMIT_MAX_AUTH) || 1000;
        const unauthenticatedLimit = Number(process.env.API_RATE_LIMIT_MAX_UNAUTH) || 50;
        return req.user ? authenticatedLimit : unauthenticatedLimit;
    },
    keyGenerator: (req) => {
        const user = normalizeApiJwtUser(req.user);
        return user?.id != null && user.id !== '' ? String(user.id) : ipKeyGenerator(req.ip);
    },
    skip: (req) => process.env.NODE_ENV !== 'production', // Evaluate at request time
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

export { unauthenticatedApiRateLimiter };
export default dynamicRateLimiter;
