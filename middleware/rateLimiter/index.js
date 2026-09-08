import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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
 * Resolves the general rate limiter configuration from the environment.
 *
 * @returns {{ windowMs: number, authLimit: number, unauthLimit: number }} Resolved config.
 */
function resolveConfigFromEnv() {
    return {
        windowMs: Number(process.env.APP_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        authLimit: Number(process.env.APP_RATE_LIMIT_MAX_AUTH) || 1000,
        unauthLimit: Number(process.env.APP_RATE_LIMIT_MAX_UNAUTH) || 500
    };
}

/**
 * Creates the general rate limiting middleware for web app routes.
 *
 * Configuration is resolved once when the middleware is created, rather than
 * read from process.env on every request. Authenticated users (identified by
 * Entra OID) are keyed per-user; unauthenticated requests are keyed by IP.
 *
 * Configuration can be injected explicitly (used by tests) or resolved from the
 * environment when omitted (the default used by app wiring):
 * - APP_RATE_LIMIT_WINDOW_MS: Time frame in milliseconds (default: 15 minutes)
 * - APP_RATE_LIMIT_MAX_AUTH: Max requests for authenticated users (default: 1000)
 * - APP_RATE_LIMIT_MAX_UNAUTH: Max requests for unauthenticated users (default: 500)
 *
 * @param {Object} [config] - Optional explicit config. Resolved from env when omitted.
 * @param {number} [config.windowMs] - Rate limit window in milliseconds.
 * @param {number} [config.authLimit] - Max requests for authenticated users.
 * @param {number} [config.unauthLimit] - Max requests for unauthenticated users.
 * @returns {import('express').RequestHandler} The configured rate limiter middleware.
 */
export function createGeneralRateLimiter(config = {}) {
    const defaults = resolveConfigFromEnv();
    const windowMs = config.windowMs ?? defaults.windowMs;
    const authLimit = config.authLimit ?? defaults.authLimit;
    const unauthLimit = config.unauthLimit ?? defaults.unauthLimit;

    return rateLimit({
        windowMs,
        limit: (req) => (req.session?.loggedIn ? authLimit : unauthLimit),
        keyGenerator: generateRateLimitKey,
        handler: (req, res) => {
            res.status(429).json({ error: 'Too many requests, please try again later' });
        }
    });
}

export default createGeneralRateLimiter;
