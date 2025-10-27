'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    return res.render('index/index.njk', {
        pageType: ['root']
    });
});

router.get('/cookies', (req, res) => {
    return res.render('index/cookies.njk', {
        pageType: ['root']
    });
});

router.get('/contact-us', (req, res) => {
    return res.render('index/contact-us.njk', {
        pageType: ['root']
    });
});

router.get('/accessibility-statement', (req, res) => {
    return res.render('index/accessibility-statement.njk', {
        pageType: ['root']
    });
});

export default router;
