'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    return res.render('index/index.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'root'
    });
});

export default router;
