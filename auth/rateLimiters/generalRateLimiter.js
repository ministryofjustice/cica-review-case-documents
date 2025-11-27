import rateLimit from 'express-rate-limit';

const windowMs = process.env.RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
    : 15 * 60 * 1000; // Default: 15 minutes

const max = process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX, 10)
    : 100; // Default: 100 requests

const generalRateLimiter = rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.session?.id || 'no-session'
});

export default generalRateLimiter;
