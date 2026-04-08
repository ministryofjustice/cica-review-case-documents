import { renderHtml as defaultRenderHtml } from '../../templateEngine/render-html.js';
import { LoginLockoutError } from './authRateLimiter.js'; // Import new name

/**
 * Express error handler middleware for rate limiting errors.
 * If the error is an instance of RateLimitError, renders a lockout page using the provided template engine.
 * Otherwise, passes the error to the next middleware.
 *
 * @param {function} [renderHtml=defaultRenderHtml] - Shared HTML render helper.
 * @returns {function} Express error handling middleware.
 */
export default function rateLimitErrorHandler(renderHtml = defaultRenderHtml) {
    return (err, req, res, next) => {
        // Only handle Login Lockouts here
        if (err instanceof LoginLockoutError) {
            const pageData = {
                lockedOut: true,
                lockoutWarning:
                    'You have been locked out for 2 hours due to too many failed attempts.'
            };
            return res.status(429).send(renderHtml('index/login.njk', pageData, req, res));
        }
        next(err);
    };
}
