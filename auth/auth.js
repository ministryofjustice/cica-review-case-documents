import express from 'express';
import bodyParser from 'body-parser';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();
router.use(bodyParser.json());

const AUTH_SECRET_PASSWORD = process.env.AUTH_SECRET_PASSWORD;

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
    const { password } = req.body;
    const redirectUrl = req.session.returnTo || '/';
    if (password === AUTH_SECRET_PASSWORD) {
        req.session.loggedIn = true;
        // res.cookie('session_id', req.sessionID, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === 'production',
        //     sameSite: 'Lax'
        // });
        return res.redirect(redirectUrl);
    }
    console.warn(`Failed login attempt from IP: ${req.ip}`);
    // Redirect with error as query param
    res.redirect('/auth/login?error=Invalid%20password.');
});

export default router;
