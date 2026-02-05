import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isProduction = () => process.env.NODE_ENV === 'production';

const AUTHENTICATED_LIMIT = Number(process.env.APP_RATE_LIMIT_MAX_AUTH) || 1000;
const UNAUTHENTICATED_LIMIT = Number(process.env.APP_RATE_LIMIT_MAX_UNAUTH) || 50;
const WINDOW_MS = Number(process.env.APP_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // Default to 15 minutes

/**
 * Determines rate limit per request based on authentication status.
 * @private
 */
function getLimitPerRequest(req) {
    return req.session?.loggedIn || req.user ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;
}

/**
 * Generates unique key for rate limiting per client.
 * Priority: session ID > user ID > IP address
 * @private
 */
function generateRateLimitKey(req) {
    if (req.session?.loggedIn && req.session?.id) {
        return req.session.id;
    }
    if (req.user?.id) {
        return req.user.id;
    }
    return ipKeyGenerator(req);
}

/**
 * Determines whether to skip rate limiting (non-production only).
 * @private
 */
function shouldSkipRateLimit() {
    return !isProduction();
}

/**
 * Express middleware for general rate limiting.
 *
 * Applies rate limiting to incoming requests based on session ID, except in development mode
 * and for POST requests to '/auth/login'. The rate limit window and maximum requests are configurable.
 *
 * @type {import('express').RequestHandler}
 *
 * @param {Object} options - Rate limiter configuration options.
 * @param {number} options.windowMs - Time frame for rate limiting in milliseconds.
 * @param {number} options.limit - Maximum number of requests allowed per windowMs.
 * @param {function} options.skip - Function to determine if rate limiting should be skipped for a request.
 * @param {function} options.keyGenerator - Function to generate a unique key for each client (uses session ID).
 *
 * @returns {import('express').RequestHandler} Express middleware for rate limiting.
 */
const generalRateLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: getLimitPerRequest,
    keyGenerator: generateRateLimitKey,
    skip: shouldSkipRateLimit,
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

export default generalRateLimiter;
