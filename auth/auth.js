import express from 'express';
import bodyParser from 'body-parser';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();
router.use(bodyParser.json());

const AUTH_SECRET_PASSWORD = process.env.AUTH_SECRET_PASSWORD;
const AUTH_USERNAMES = (process.env.AUTH_USERNAMES || '')
    .split(',')
    .map((u) => u.trim().toLowerCase());

router.get('/login', (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('views/login.njk', {
            csrfToken: res.locals.csrfToken,
            error: req.query.error
        });
        res.send(html);
    } catch (err) {
        next(err);
    }
});

router.post('/login', (req, res) => {
    const { username = '', password = '' } = req.body;
    const redirectUrl = req.session.returnTo || '/';
    let error = '';

    if (!username && !password) {
        error = 'Enter your username and password';
    } else if (!username) {
        error = 'Enter your username';
    } else if (!password) {
        error = 'Enter your password';
    }

    const normalizedUsername = username.toLowerCase();

    if (error) {
        return res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
    }

    if (password === AUTH_SECRET_PASSWORD && AUTH_USERNAMES.includes(normalizedUsername)) {
        req.session.loggedIn = true;
        return res.redirect(redirectUrl);
    }

    req.log.warn(`Failed login attempt from IP: ${req.ip}`);
    error = 'Invalid credentials';
    return res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
});

export default router;
