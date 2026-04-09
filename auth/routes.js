import express from 'express';

import { createCallbackHandler } from './handlers/callback-handler.js';
import { createLoginHandler } from './handlers/login-handler.js';
import { signOutUser } from './handlers/sign-out-handler.js';
import {
    entraCallbackRateLimiter,
    entraLoginRateLimiter
} from './rateLimiters/entraRateLimiter.js';

const router = express.Router();
router.get('/login', entraLoginRateLimiter, createLoginHandler());
router.get('/callback', entraCallbackRateLimiter, createCallbackHandler());

router.get('/sign-out', (req, res, next) => {
    try {
        signOutUser(req, res, next);
    } catch (err) {
        next(err);
    }
});

export default router;

export { createLoginHandler };
