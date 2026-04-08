import express from 'express';
import generalRateLimiter from '../middleware/rateLimiter/index.js';
import { renderHtml as defaultRenderHtml } from '../templateEngine/render-html.js';
import { loginParamsValidator, signOutUser } from './auth-service.js';
import failureRateLimiter from './rateLimiters/authRateLimiter.js';
import { getLoginAttemptContext, renderLoginResponse } from './utils/loginHelpers/login-helpers.js';

const router = express.Router();

export const createLoginHandler =
    (renderHtml = defaultRenderHtml) =>
    (req, res, next) => {
        try {
            res.send(renderHtml('index/login.njk', {}, req, res));
        } catch (err) {
            next(err);
        }
    };

router.get('/login', generalRateLimiter, createLoginHandler());

router.post('/login', failureRateLimiter, (req, res) => {
    const { username = '', password = '' } = req.body;
    const { error, usernameError, passwordError } = loginParamsValidator(username, password);

    const hasBoth = username && password;
    const { attemptsLeft, lockoutWarning } = getLoginAttemptContext(
        req,
        username,
        password,
        usernameError,
        passwordError
    );

    // Missing username or password: Bad Request
    if (!hasBoth) {
        return renderLoginResponse(
            res,
            {
                csrfToken: res.locals.csrfToken,
                error: 'Enter your username and password',
                usernameError,
                passwordError,
                username,
                attemptsLeft,
                status: 400
            },
            req
        );
    }

    // Invalid credentials: Unauthorized
    if (error || usernameError || passwordError) {
        return renderLoginResponse(
            res,
            {
                csrfToken: res.locals.csrfToken,
                error: 'Your details do not match',
                usernameError,
                passwordError,
                username,
                attemptsLeft,
                lockoutWarning,
                status: 401
            },
            req
        );
    }

    // Success path
    req.session.username = username;
    req.session.loggedIn = true;
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    return res.redirect(redirectUrl);
});

router.get('/sign-out', generalRateLimiter, (req, res, next) => {
    signOutUser(req, res, next);
});

export default router;
