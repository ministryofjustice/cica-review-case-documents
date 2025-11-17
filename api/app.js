'use strict';

import express from 'express';
import helmet from 'helmet';
import pino from 'pino-http';
import session from 'express-session';
import searchRouter from './search/routes.js';

const router = express.Router();

const sessionMiddleware = session({
    secret: process.env.APP_COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    },
    name: process.env.APP_COOKIE_NAME
});

router.use(express.json({type: 'application/vnd.api+json'}));
router.use(pino());
router.use(helmet());
router.use(sessionMiddleware);

// Protect all API routes
router.use((req, res, next) => {
    if (!req.session.loggedIn) {
        const err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }
    next();
});

router.use('/search', searchRouter);

export default router;
