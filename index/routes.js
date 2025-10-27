'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    return res.render('index/index.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['root']
    });
});

router.get('/cookies', (req, res) => {
    return res.render('index/cookies.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['root']
    });
});

router.get('/contact-us', (req, res) => {
    return res.render('index/contact-us.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['root']
    });
});

router.get('/accessibility-statement', (req, res) => {
    return res.render('index/accessibility-statement.njk', {
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['root']
    });
});

export default router;
