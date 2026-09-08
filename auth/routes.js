import express from 'express';

import { createCallbackHandler } from './handlers/callback-handler.js';
import { createLoginHandler } from './handlers/login-handler.js';
import { signOutUser } from './handlers/sign-out-handler.js';
import {
    createEntraCallbackRateLimiter,
    createEntraLoginRateLimiter
} from './rateLimiters/entraRateLimiter.js';

const router = express.Router();
// Config is resolved once here rather than at module load.
router.get('/login', createEntraLoginRateLimiter(), createLoginHandler());
router.get('/callback', createEntraCallbackRateLimiter(), createCallbackHandler());

router.get('/sign-out', (req, res, next) => {
    try {
        signOutUser(req, res, next);
    } catch (err) {
        next(err);
    }
});

export default router;

export { createLoginHandler };
