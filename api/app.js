'use strict';

import express from 'express';
import helmet from 'helmet';
import pino from 'pino-http';
import searchRouter from './search/routes.js';
import createLogger from '../logger/index.js';
import createApp from '../app.js';

const router = express.Router();
const {sessionMiddleware} = createApp();

router.use(express.json({type: 'application/vnd.api+json'}));
router.use(
    pino({
        logger: createLogger()
    })
);
router.use(sessionMiddleware);
router.use(helmet());

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
