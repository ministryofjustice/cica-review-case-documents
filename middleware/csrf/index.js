import VError from 'verror';

// import {doubleCsrf} from 'csrf-csrf';

/**
 * Initializes CSRF protection and token generation using the `csrf-csrf` library.
 *
 * This configuration provides both a middleware (`doubleCsrfProtection`) that validates
 * incoming CSRF tokens, and a helper function (`generateCsrfToken`) that can be used to
 * generate new tokens for forms or API responses.
 *
 * The configuration uses session-based identification and environment-dependent cookie
 * settings to ensure secure CSRF protection across environments.
 *
 * @example
 * // Example usage in an Express app:
 * import express from 'express';
 * import { doubleCsrfProtection, generateCsrfToken } from './csrf.js';
 *
 * const app = express();
 * app.use(doubleCsrfProtection);
 *
 * app.get('/form', (req, res) => {
 *   const csrfToken = generateCsrfToken(req, res);
 *   res.render('form', { csrfToken });
 * });
 *
 * @see {@link https://www.npmjs.com/package/csrf-csrf|csrf-csrf on npm}
 *
 * @returns {{doubleCsrfProtection: import('express').RequestHandler, generateCsrfToken: Function}}
 * Returns an object containing:
 * - `doubleCsrfProtection`: Express middleware to validate CSRF tokens.
 * - `generateCsrfToken`: Function to generate a new CSRF token.
 */

import { doubleCsrf as defaultDoubleCsrf } from 'csrf-csrf';

function createCsrf(doubleCsrf = defaultDoubleCsrf) {
    const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
        /**
         * Retrieves the secret key used for signing CSRF cookies.
         *
         * @throws {VError} Throws a ConfigurationError if `APP_COOKIE_SECRET` is not defined.
         * @returns {string} The secret key from `process.env.APP_COOKIE_SECRET`.
         */
        getSecret: () => {
            if (process.env.APP_COOKIE_SECRET === undefined) {
                throw new VError(
                    {
                        name: 'ConfigurationError'
                    },
                    'Environment variable "APP_COOKIE_SECRET" must be set'
                );
            }
            return process.env.APP_COOKIE_SECRET;
        },
        /**
         * Retrieves the session identifier from the request object.
         *
         * @param {Object} req - Express request object.
         * @param {Object} req.session - Session object attached by session middleware.
         * @param {string} req.session.id - Session ID.
         * @throws {VError} Throws a ConfigurationError if session is not defined, or is invalid.
         * @returns {string} Session ID to associate with the CSRF token.
         */
        getSessionIdentifier: (req) => {
            if (!req.session || !req.session.id) {
                throw new VError(
                    {
                        name: 'ConfigurationError'
                    },
                    'Session is missing or invalid. CSRF protection requires a valid session'
                );
            }
            return req.session.id;
        },
        // eslint-disable-next-line no-underscore-dangle
        getCsrfTokenFromRequest: (req) => req.body._csrf,
        cookieName:
            process.env.NODE_ENV === 'production' ? '__Host-request-config' : 'request-config', // renamed `_csrf` cookie name.
        cookieOptions: {
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'Lax'
        }
    });

    return {
        doubleCsrfProtection,
        generateCsrfToken
    };
}

export default createCsrf;
