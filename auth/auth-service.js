/**
 * Validates login parameters (username and password).
 *
 * @param {string} username - The username to validate.
 * @param {string} password - The password to validate.
 * @returns {{ error: string, usernameError: string, passwordError: string }} - An object containing error messages for the login attempt.
 */

/**
 * Signs out the user by destroying the session, clearing the JWT cookie, and rendering the sign-out page.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 */
import { getAuthConfig } from './utils/getAuthConfig/index.js';
import createTemplateEngineService from '../templateEngine/index.js';
import jwtCookieOptions from './jwtCookieOptions.js';
import failureRateLimiter, { getRateLimitKey } from './rateLimiters/authRateLimiter.js';

/**
 * Validates login parameters (username and password) against authentication configuration.
 *
 * @param {string} username - The username to validate.
 * @param {string} password - The password to validate.
 * @returns {{ error: string, usernameError: string, passwordError: string }}
 * An object containing error messages for the overall login, username, and password fields.
 */
export function loginParamsValidator(username, password) {
    const { secret, usernames } = getAuthConfig();
    const normalizedUsername = (username || '').toLowerCase();

    let error = '';
    let usernameError = '';
    let passwordError = '';

    if (!username && !password) {
        error = 'Enter your username';
        usernameError = 'Enter your username';
        passwordError = 'Enter your password';
    } else if (!username) {
        error = 'Enter your username';
        usernameError = 'Enter your username';
    } else if (!password) {
        error = 'Enter your password';
        passwordError = 'Enter your password';
    } else if (
        typeof username !== 'string' ||
        !username.includes('@') ||
        username.lastIndexOf('.') < username.indexOf('@') + 2
    ) {
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    } else if (password !== secret || !usernames.includes(normalizedUsername)) {
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    }

    return { error, usernameError, passwordError };
}

/**
 * Signs out the current user by destroying their session, clearing the JWT cookie,
 * resetting the rate limiter key if applicable, and rendering the sign-out page.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 */
export function signOutUser(req, res, next) {
    const caseReferenceNumber = req.session?.caseReferenceNumber;
    let rateLimitKey = getRateLimitKey(req);

    if (rateLimitKey && typeof failureRateLimiter.resetKey === 'function') {
        failureRateLimiter.resetKey(rateLimitKey);
    }

    req.session.destroy(() => {
        res.clearCookie('jwtToken', jwtCookieOptions);

        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/sign-out.njk', {
            message: 'You have signed out',
            caseReferenceNumber
        });
        res.send(html);
    });
}
