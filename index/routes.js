'use strict';

import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();

router.get('/', (req, res) => {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;
    const html = render('index/index.njk', {
        pageType: ['root']
    });
    return res.send(html);
});

router.get('/cookies', (req, res) => {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;
    const html = render('index/cookies.njk', {
        pageType: ['root']
    });
    return res.send(html);
});

router.get('/contact-us', (req, res) => {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;
    const html = render('index/contact-us.njk', {
        pageType: ['root']
    });
    return res.send(html);
});

router.get('/accessibility-statement', (req, res) => {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;
    const html = render('index/accessibility-statement.njk', {
        pageType: ['root']
    });
    return res.send(html);
});

export default router;
