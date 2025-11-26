import rateLimit from 'express-rate-limit';

const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Maximum requests per window
    keyGenerator: (req) => req.session.id
});

export default generalRateLimiter;
