import express from 'express';
import bodyParser from 'body-parser';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();
router.use(bodyParser.json());

const AUTH_SECRET_PASSWORD = process.env.AUTH_SECRET_PASSWORD;

const AUTH_USERNAMES = (process.env.AUTH_USERNAMES || '').split(',').map(u => u.trim());

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
    const { username,password } = req.body;
    const redirectUrl = req.session.returnTo || '/';

    var error = "Invalid credentials."

    if(!password && !username){
        error = "Enter your username and password."
        res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
    }
    if(!password){
        error = "Enter your password."
        res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
    }
    if(!username){
        error = "Enter your username."
        res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
    }

    if (password === AUTH_SECRET_PASSWORD && AUTH_USERNAMES.includes(username)) {
        req.session.loggedIn = true;
        return res.redirect(redirectUrl);
    }
    console.warn(`Failed login attempt from IP: ${req.ip}`);
    // Redirect with error as query param
    res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
});

export default router;
