/**
 * Express router for authentication routes.
 * Handles login and sign-out functionality.
 *
 * @module auth
 */

import express from 'express';
import createTemplateEngineService from '../templateEngine/index.js';
import { validateLogin } from './auth-service.js';
import jwt from 'jsonwebtoken';

/**
 * GET /login
 * Renders the login page with optional error messages.
 *
 * @name GET /auth/login
 * @function
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 */

/**
 * POST /login
 * Handles login form submission, validates credentials, and redirects accordingly.
 *
 * @name POST /auth/login
 * @function
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object.
 */

/**
 * GET /sign-out
 * Destroys the session and renders the sign-out page.
 *
 * @name GET /auth/sign-out
 * @function
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 */

const router = express.Router();

router.get('/login', (req, res, next) => {
    try {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/login.njk', {
            csrfToken: res.locals.csrfToken
        });
        res.send(html);
    } catch (err) {
        next(err);
    }
});

router.post('/login', (req, res) => {
    const { username = '', password = '' } = req.body;
    const { error, usernameError, passwordError } = validateLogin(username, password);

    if (error || usernameError || passwordError) {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/login.njk', {
            csrfToken: res.locals.csrfToken,
            error,
            usernameError,
            passwordError,
            username
        });
        return res.send(html);
    }

    // Credentials are valid, generate JWT
    const user = { username };
    let token;
    try {
        token = jwt.sign(user, process.env.APP_JWT_SECRET, { expiresIn: '1h' });
    } catch (err) {
        return res.status(500).send('Error generating authentication token');
    }

    res.cookie('jwtToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000
    });

    req.log?.info({ username }, 'User logged in');

    // Redirect to the stored return URL or default to '/'
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo; // Clean up after redirect
    return res.redirect(redirectUrl);
});

router.get('/sign-out', (req, res, next) => {
    const caseReferenceNumber = req.session?.caseReferenceNumber;
    req.session.destroy(() => {
        // Clear the JWT cookie
        res.clearCookie('jwtToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/sign-out.njk', {
            message: 'You have signed out',
            caseReferenceNumber
        });
        res.send(html);
    });
});

export default router;
