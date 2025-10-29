'use strict';

import express from 'express';
import searchRouter from './search/routes.js';

const router = express.Router();

router.use('/search', searchRouter);

export default router;
