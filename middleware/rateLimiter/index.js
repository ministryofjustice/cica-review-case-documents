import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const windowMs = process.env.APP_RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.APP_RATE_LIMIT_WINDOW_MS, 10)
    : 15 * 60 * 1000; // Default: 15 minutes

const max = process.env.APP_RATE_LIMIT_MAX ? parseInt(process.env.APP_RATE_LIMIT_MAX, 10) : 100; // Default: 100 requests

const generalRateLimiter = rateLimit({
    windowMs,
    max,
    skip: (req, res) => !isProduction, // Function that returns true to skip rate limiting
    keyGenerator: (req) => req.session?.id || 'no-session'
});

export default generalRateLimiter;
