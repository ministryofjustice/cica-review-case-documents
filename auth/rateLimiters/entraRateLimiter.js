import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

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
 * Resolves the Entra rate limiter configuration from the environment.
 *
 * @returns {{ windowMs: number, loginLimit: number, callbackLimit: number }} Resolved config.
 */
function resolveConfigFromEnv() {
    return {
        windowMs: Number(process.env.APP_ENTRA_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        loginLimit: Number(process.env.APP_ENTRA_RATE_LIMIT_MAX_LOGIN) || 20,
        callbackLimit: Number(process.env.APP_ENTRA_RATE_LIMIT_MAX_CALLBACK) || 40
    };
}

/**
 * Creates an Entra rate limiter with the provided window and request limit.
 *
 * @param {Object} options - Limiter options.
 * @param {number} options.windowMs - Rate limit window in milliseconds.
 * @param {number} options.limit - Maximum requests allowed per window.
 * @returns {import('express').RequestHandler} Rate limiter middleware.
 */
function createEntraRateLimiter({ windowMs, limit }) {
    return rateLimit({
        windowMs,
        limit,
        keyGenerator: generateEntraRateLimitKey,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many authentication requests, please try again later'
            });
        }
    });
}

/**
 * Creates the Entra login rate limiter. Config is resolved once at creation
 * time (from injected config, or env when omitted) rather than at module load.
 *
 * @param {Object} [config] - Optional explicit config. Resolved from env when omitted.
 * @param {number} [config.windowMs] - Rate limit window in milliseconds.
 * @param {number} [config.loginLimit] - Max login requests per window.
 * @returns {import('express').RequestHandler} Login rate limiter middleware.
 */
export function createEntraLoginRateLimiter(config = {}) {
    const defaults = resolveConfigFromEnv();
    const windowMs = config.windowMs ?? defaults.windowMs;
    const loginLimit = config.loginLimit ?? defaults.loginLimit;
    return createEntraRateLimiter({ windowMs, limit: loginLimit });
}

/**
 * Creates the Entra callback rate limiter. Config is resolved once at creation
 * time (from injected config, or env when omitted) rather than at module load.
 *
 * @param {Object} [config] - Optional explicit config. Resolved from env when omitted.
 * @param {number} [config.windowMs] - Rate limit window in milliseconds.
 * @param {number} [config.callbackLimit] - Max callback requests per window.
 * @returns {import('express').RequestHandler} Callback rate limiter middleware.
 */
export function createEntraCallbackRateLimiter(config = {}) {
    const defaults = resolveConfigFromEnv();
    const windowMs = config.windowMs ?? defaults.windowMs;
    const callbackLimit = config.callbackLimit ?? defaults.callbackLimit;
    return createEntraRateLimiter({ windowMs, limit: callbackLimit });
}
