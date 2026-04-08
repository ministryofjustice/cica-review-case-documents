import express from 'express';
import { renderHtml } from '../templateEngine/render-html.js';

const router = express.Router();

router.get('/', (req, res) => {
    const html = renderHtml('index/index.njk', { pageType: ['root'] }, req, res);
    return res.send(html);
});

router.get('/cookies', (req, res) => {
    const html = renderHtml('index/cookies.njk', { pageType: ['root'] }, req, res);
    return res.send(html);
});

router.get('/contact-us', (req, res) => {
    const html = renderHtml('index/contact-us.njk', { pageType: ['root'] }, req, res);
    return res.send(html);
});

router.get('/accessibility-statement', (req, res) => {
    const html = renderHtml('index/accessibility-statement.njk', { pageType: ['root'] }, req, res);
    return res.send(html);
});

export default router;
