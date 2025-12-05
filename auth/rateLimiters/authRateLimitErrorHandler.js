import createTemplateEngineService from '../../templateEngine/index.js';
import { LoginLockoutError } from './authRateLimiter.js'; // Import new name
/**
 * Express error handler middleware for rate limiting errors.
 * If the error is an instance of RateLimitError, renders a lockout page using the provided template engine.
 * Otherwise, passes the error to the next middleware.
 *
 * @param {object} app - The Express application instance.
 * @param {function} [templateEngineFactory=createTemplateEngineService] - Factory function to create the template engine service.
 * @returns {function} Express error handling middleware.
 */
export default function rateLimitErrorHandler(
    app,
    templateEngineFactory = createTemplateEngineService
) {
    return (err, req, res, next) => {
        // Only handle Login Lockouts here
        if (err instanceof LoginLockoutError) {
            const templateEngineService = templateEngineFactory(app);
            const { render } = templateEngineService;
            const html = render('index/login.njk', {
                csrfToken: res.locals.csrfToken,
                lockedOut: true,
                lockoutWarning:
                    'You have been locked out for 2 hours due to too many failed attempts.'
            });
            return res.status(429).send(html);
        }
        next(err);
    };
}
