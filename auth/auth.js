import express from 'express';
import bodyParser from 'body-parser';
import createTemplateEngineService from '../templateEngine/index.js';

const router = express.Router();
router.use(bodyParser.json());

function getAuthConfig() {
    const secret = process.env.AUTH_SECRET_PASSWORD;
    const usernames = (process.env.AUTH_USERNAMES || '')
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);
    return { secret, usernames };
}

router.get('/login', (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('views/login.njk', {
            csrfToken: res.locals.csrfToken,
            error: req.query.error,
            usernameError: req.query.usernameError,
            passwordError: req.query.passwordError,
            username: req.query.username || ''
        });
        res.send(html);
    } catch (err) {
        next(err);
    }
});

router.post('/login', (req, res) => {
    const { username = '', password = '' } = req.body;
    const redirectUrl = req.session.returnTo || '/';

    const { secret, usernames } = getAuthConfig();
    const normalizedUsername = username.toLowerCase();

    let error = '';
    let usernameError = '';
    let passwordError = '';

    if (!username && !password) {
        // Both missing
        error = 'Enter your username';
        usernameError = 'Enter your username';
        passwordError = 'Enter your password';
    } else if (!username) {
        error = 'Enter your username';
        usernameError = 'Enter your username';
    } else if (!password) {
        error = 'Enter your password';
        passwordError = 'Enter your password';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    } else if (password !== secret || !usernames.includes(normalizedUsername)) {
        // Invalid credentials
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    }

    if (error || usernameError || passwordError) {
        const params = new URLSearchParams();
        if (error) params.append('error', error);
        if (usernameError) params.append('usernameError', usernameError);
        if (passwordError) params.append('passwordError', passwordError);
        if (username) params.append('username', username);
        return res.redirect(`/auth/login?${params.toString()}`);
    }

    req.session.loggedIn = true;
    return res.redirect(redirectUrl);
});

router.get('/sign-out', (req, res, next) => {
    // Store the caseReferenceNumber before destroying the session
    const caseReferenceNumber = req.session?.caseReferenceNumber;
    req.session.destroy(() => {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('views/sign-out.njk', {
            message: 'You have signed out',
            caseReferenceNumber
        });
        res.send(html);
    });
});

export default router;
