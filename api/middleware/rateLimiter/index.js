/**
 * Express middleware for dynamic rate limiting based on authentication status.
 *
 * - Authenticated users have a higher request limit than unauthenticated users/requests.
 * - Limits and window duration are configurable via environment variables:
 *   - API_RATE_LIMIT_MAX_AUTH: Max requests for authenticated users/requests (default: 1000)
 *   - API_RATE_LIMIT_MAX_UNAUTH: Max requests for unauthenticated users/requests (default: 50)
 *   - API_RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - Uses user ID as the key for authenticated users, IP address otherwise.
 * - Rate limiting is enforced in all environments.
 * - Responds with HTTP 429 and a JSON error message when the limit is exceeded.
 *
 * @module middleware/rateLimiter
 * @type {import('express').RequestHandler}
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import normalizeApiJwtUser from '../utils/normalizeApiJwtUser.js';

/**
 * Default rate limit window duration in milliseconds (15 minutes).
 *
 * @type {number}
 */
const WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

/**
 * Dynamic rate limiter for API requests based on authentication status.
 *
 * NOTE: This middleware is placed AFTER authenticateJWTToken. While CodeQL flags auth-before-ratelimit,
 * JWT validation is lightweight (signature check, not DB/filesystem operations). The expensive operations
 * occur downstream. User-based rate limiting (after auth) prevents VPN/NAT blocking issues.
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
        return user?.username != null && user.username !== ''
            ? String(user.username)
            : ipKeyGenerator(req.ip);
    },
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

export default dynamicRateLimiter;
