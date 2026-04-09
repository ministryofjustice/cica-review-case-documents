import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const WINDOW_MS = Number(process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const LOGIN_LIMIT = Number(process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN) || 20;
const CALLBACK_LIMIT = Number(process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK) || 40;

/**
 * Builds a per-client key for Entra auth throttling using request IP.
 *
 * @param {import('express').Request} req - Express request.
 * @returns {string} Stable key for rate limiting.
 */
export function generateEntraRateLimitKey(req) {
    return ipKeyGenerator(req.ip);
}

/**
 * Creates an Entra rate limiter with the provided request limit.
 *
 * @param {number} limit - Maximum requests allowed per window.
 * @returns {import('express').RequestHandler} Rate limiter middleware.
 */
function createEntraRateLimiter(limit) {
    return rateLimit({
        windowMs: WINDOW_MS,
        limit,
        keyGenerator: generateEntraRateLimitKey,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many authentication requests, please try again later'
            });
        }
    });
}

export const entraLoginRateLimiter = createEntraRateLimiter(LOGIN_LIMIT);
export const entraCallbackRateLimiter = createEntraRateLimiter(CALLBACK_LIMIT);
