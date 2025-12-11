import rateLimit from 'express-rate-limit';

export const getRateLimitKey = (req) => {
    if (req.session?.username) return req.session.username.toLowerCase().trim();
    return req.ip.replace(/^::ffff:/, ''); // Centralized IP logic
};
export class LoginLockoutError extends Error {
    constructor(message = 'Too many login attempts, please try again later') {
        super(message);
        this.name = 'LoginLockoutError'; // Update name
        this.statusCode = 429;
    }
}

/**
 * Creates a rate limiter middleware for authentication failure attempts.
 * Limits the number of failed login attempts per username within a specified time window.
 * Skips rate limiting for requests with missing username or password fields.
 *
 * @param {object} app - The Express application instance.
 * @param {object} [options] - Configuration options.
 * @param {number} [options.windowMs=600000] - Time window in milliseconds for rate limiting (default: 10 minutes).
 * @param {number} [options.maxFailures=5] - Maximum number of failed attempts allowed within the window.
 * @returns {function} Express middleware for rate limiting failed login attempts.
 */
export function createFailureRateLimiter(
    app,
    {
        windowMs = process.env.AUTH_RATE_LIMIT_WINDOW_MS
            ? Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS)
            : 10 * 60 * 1000, // 10 minutes default
        maxFailures = 5
    } = {}
) {
    return rateLimit({
        windowMs,
        limit: maxFailures - 1, // Allow maxFailures attempts, then lockout on the next
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
