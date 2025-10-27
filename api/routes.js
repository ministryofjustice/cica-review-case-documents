'use strict';

import express from 'express';
import searchRouter from './search/routes.js';
import documentsRouter from './documents/routes.js';

const router = express.Router();

// router.use(caseRouter);
router.use('/search', searchRouter);
router.use('/documents', documentsRouter);

export default router;
