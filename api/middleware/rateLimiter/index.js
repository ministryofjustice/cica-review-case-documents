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

const isProduction = process.env.NODE_ENV === 'production';

const AUTHENTICATED_LIMIT = Number(process.env.API_RATE_LIMIT_MAX_AUTH) || 1000;
const UNAUTHENTICATED_LIMIT = Number(process.env.API_RATE_LIMIT_MAX_UNAUTH) || 50;
const WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const dynamicRateLimiter = rateLimit({
    windowMs: WINDOW_MS,
    // Use a function to set the limit per request
    limit: (req, res) => (req.user ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT),
    keyGenerator: (req) => (req.user?.id ? req.user.id : ipKeyGenerator(req)),
    skip: (req) => !isProduction, // Skip in non-production
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later' });
    }
});

export default dynamicRateLimiter;
