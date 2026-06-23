import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const WINDOW_MS = Number(process.env.APP_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // Default to 15 minutes

/**
 * Determines rate limit per request based on authentication status.
 * @param {import('express').Request} req - Express request object
 * @returns {number} Rate limit for the request
 * @private
 */
function getLimitPerRequest(req) {
    const authenticatedLimit = Number(process.env.APP_RATE_LIMIT_MAX_AUTH) || 1000;
    const unauthenticatedLimit = Number(process.env.APP_RATE_LIMIT_MAX_UNAUTH) || 500;
    return req.session?.loggedIn ? authenticatedLimit : unauthenticatedLimit;
}

/**
 * Generates a unique key for rate limiting per client.
 * Priority: req.session.entraUser.oid > IP address
 * @param {import('express').Request} req - Express request object
 * @returns {string} Rate limit key
 */
export function generateRateLimitKey(req) {
    if (req.session?.loggedIn && req.session?.entraUser?.oid) {
        return `oid:${req.session.entraUser.oid}`;
    }

    // Unauthenticated: IP is the only stable identifier for cookie-less clients
    return ipKeyGenerator(req.ip);
}

/**
 * Express middleware for general rate limiting.
 *
 * Applies rate limiting to all incoming requests. Authenticated users (identified
 * by Entra OID) are keyed per-user; unauthenticated requests are keyed by IP address.
 * The rate limit window and maximum requests are configurable via environment variables:
 * - APP_RATE_LIMIT_WINDOW_MS: Time frame in milliseconds (default: 15 minutes)
 * - APP_RATE_LIMIT_MAX_AUTH: Max requests for authenticated users (default: 1000)
 * - APP_RATE_LIMIT_MAX_UNAUTH: Max requests for unauthenticated users (default: 500)
 *
 * @type {import('express').RequestHandler}
 */
const generalRateLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: getLimitPerRequest,
    keyGenerator: generateRateLimitKey,
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

export default generalRateLimiter;
