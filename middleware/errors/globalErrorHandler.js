import { renderHtml as defaultRenderHtml } from '../../templateEngine/render-html.js';

/**
 * Express middleware for handling global errors.
 *
 * Logs the error, renders a user-friendly error page, and sends the appropriate HTTP status code.
 * If response headers have already been sent, passes the error to the next middleware.
 *
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @param {Function} [renderHtml=defaultRenderHtml] - Shared HTML render helper.
 */
export default function errorHandler(err, req, res, next, renderHtml = defaultRenderHtml) {
    const log = req.log || console;
    const status = err.status || err.statusCode || 500;

    log.error({ err, status }, 'Application Error');

    if (res.headersSent) {
        return next(err);
    }

    const html = renderHtml(
        'page/error.njk',
        {
            error: 'Sorry, there is a problem with the service.'
        },
        req,
        res
    );

    res.status(status).send(html);
}
