import express from 'express';
import jwt from 'jsonwebtoken';
import generalRateLimiter from '../middleware/rateLimiter/index.js';
import createTemplateEngineService from '../templateEngine/index.js';
import { loginParamsValidator, signOutUser } from './auth-service.js';
import jwtCookieOptions from './jwtCookieOptions.js';
import failureRateLimiter from './rateLimiters/authRateLimiter.js';
import { getLoginAttemptContext, renderLoginResponse } from './utils/loginHelpers/login-helpers.js';

const router = express.Router();

export const createLoginHandler =
    (templateEngineServiceFactory = createTemplateEngineService) =>
    (req, res, next) => {
        try {
            const templateEngineService = templateEngineServiceFactory();
            const { render } = templateEngineService;
            const html = render('index/login.njk', {
                csrfToken: res.locals.csrfToken
            });
            res.send(html);
        } catch (err) {
            next(err);
        }
    };

router.get('/login', generalRateLimiter, createLoginHandler());

router.post('/login', failureRateLimiter, (req, res, next) => {
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
        return renderLoginResponse(res, {
            csrfToken: res.locals.csrfToken,
            error: 'Enter your username and password',
            usernameError,
            passwordError,
            username,
            attemptsLeft,
            status: 400
        });
    }

    // Invalid credentials: Unauthorized
    if (error || usernameError || passwordError) {
        return renderLoginResponse(res, {
            csrfToken: res.locals.csrfToken,
            error: 'Your details do not match',
            usernameError,
            passwordError,
            username,
            attemptsLeft,
            lockoutWarning,
            status: 401
        });
    }

    // Success path
    const user = { username };
    let token;
    try {
        token = jwt.sign(user, process.env.APP_JWT_SECRET, { expiresIn: '1h' });
    } catch (err) {
        req.log.error({ err }, 'JWT generation error');
        return next(err);
    }

    req.session.username = username;
    res.cookie('jwtToken', token, jwtCookieOptions);
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    return res.redirect(redirectUrl);
});

router.get('/sign-out', generalRateLimiter, (req, res, next) => {
    signOutUser(req, res, next);
});

export default router;
