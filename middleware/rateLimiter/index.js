import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const windowMs = process.env.APP_RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.APP_RATE_LIMIT_WINDOW_MS, 10)
    : 15 * 60 * 1000; // Default: 15 minutes

const limit = process.env.APP_RATE_LIMIT_MAX ? parseInt(process.env.APP_RATE_LIMIT_MAX, 10) : 100; // Default: 100 requests

/**
 * Middleware for general rate limiting of incoming requests.
 *
 * @constant
 * @type {import('express').RequestHandler}
 * @param {Object} options - Configuration options for the rate limiter.
 * @param {number} options.windowMs - Time frame for which requests are checked/remembered (in milliseconds).
 * @param {number} options.limit - Maximum number of allowed requests within the windowMs.
 * @param {function} options.skip - Function to determine if rate limiting should be skipped for a request.
 * @param {function} options.keyGenerator - Function to generate a unique key for each request (used for tracking).
 *
 * @description
 * Skips rate limiting if not in production environment. Uses session ID as the key for rate limiting, or 'no-session' if unavailable.
 */
const generalRateLimiter = rateLimit({
    windowMs,
    limit: limit,
    skip: (req, res) => !isProduction, // Function that returns true to skip rate limiting
    keyGenerator: (req) => req.session?.id || 'no-session'
});

export default generalRateLimiter;
