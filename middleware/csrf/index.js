import { doubleCsrf as defaultDoubleCsrf } from 'csrf-csrf';
import VError from 'verror';

/**
 * Creates CSRF protection middleware and token generator using double CSRF strategy.
 *
 * @param {Function} [doubleCsrf=defaultDoubleCsrf] - Factory function for double CSRF protection.
 * @returns {Object} An object containing:
 *   @property {Function} doubleCsrfProtection - Express middleware for CSRF protection.
 *   @property {Function} generateCsrfToken - Function to generate a CSRF token.
 */
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
