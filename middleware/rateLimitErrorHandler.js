/**
 * Express middleware to handle rate limit errors.
 * If the error is an instance of RateLimitError, renders the login page with a lockout warning.
 * Otherwise, passes the error to the next middleware.
 *
 * @param {import('express').Application} app - The Express application instance.
 * @param {import('../templateEngine').TemplateEngineFactory} templateEngineFactory - The template engine factory.
 * @returns {import('express').ErrorRequestHandler} Middleware function to handle rate limit errors.
 */
import { RateLimitError } from '../auth/rateLimiter.js';
import createTemplateEngineService from '../templateEngine/index.js';

export default function rateLimitErrorHandler(
    app,
    templateEngineFactory = createTemplateEngineService
) {
    return function (err, req, res, next) {
        if (err instanceof RateLimitError) {
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
