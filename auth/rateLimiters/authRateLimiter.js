import rateLimit from 'express-rate-limit';

export const getRateLimitKey = (req) => {
    if (req.session?.username) return req.session.username.toLowerCase().trim();
    return req.ip.replace(/^::ffff:/, ''); // Centralized IP logic
};
export class LoginLockoutError extends Error {
    constructor(message = 'You have been locked out') {
        super(message);
        this.name = 'LoginLockoutError'; // Update name
        this.statusCode = 429;
    }
}

/**
 * Factory to create the failure rate limiter.
 * @param {import('express').Express=} app Optional express app (for template rendering).
 */
export function createFailureRateLimiter(
    app,
    {
        windowMs = 2 * 60 * 60 * 1000, // 2 hours
        maxFailures = 5
    } = {}
) {
    return rateLimit({
        windowMs,
        limit: maxFailures,
        message: 'LOCKED_OUT',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,

        // Skip limiting if fields are empty (validation error, not a security guess)
        skip: (req) => {
            if (!req.body?.username?.trim() || !req.body?.password?.trim()) {
                return true;
            }
            return false;
        },

        keyGenerator: (req, res) => {
            return (req.body?.username || '').toLowerCase().trim();
        },
        handler: (req, res, next) => {
            // Throw the specific error
            next(new LoginLockoutError());
        }
    });
}

const failureRateLimiter = createFailureRateLimiter();
export default failureRateLimiter;
