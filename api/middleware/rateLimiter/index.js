import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const API_RATE_LIMIT_MAX_PROD = Number(process.env.API_RATE_LIMIT_MAX_PROD) || 300;

const rateLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    limit: API_RATE_LIMIT_MAX_PROD,
    skip: (req, res) => {
        // Skip rate limiting in non-production
        if (!isProduction) return true;

        // Skip rate limiting if no Authorization header (let JWT auth handle it)
        if (!req.headers.authorization) return true;

        return false;
    },
    keyGenerator: (req, res) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        // Fallback (shouldn't reach here due to skip function)
        return 'no-token';
    },
    handler: (req, res) => {
        throw new Error('Too many requests, please try again later');
    }
});

export default rateLimiter;
