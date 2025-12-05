import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const windowMs = process.env.APP_RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.APP_RATE_LIMIT_WINDOW_MS, 10)
    : 15 * 60 * 1000; // Default: 15 minutes

const limit = process.env.APP_RATE_LIMIT_MAX ? parseInt(process.env.APP_RATE_LIMIT_MAX, 10) : 100; // Default: 100 requests

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
    windowMs,
    limit: limit,
    skip: (req, res) => {
        if (!isProduction) {
            return true;
        }
        // Skip rate limiting for login POST requests (handled by specific limiter)
        if (req.method === 'POST' && req.path === '/auth/login') {
            return true;
        }
        return false;
    },
    keyGenerator: (req) => req.session?.id || 'no-session'
});

export default generalRateLimiter;
