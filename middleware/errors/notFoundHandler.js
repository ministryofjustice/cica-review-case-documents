import { renderHtml as defaultRenderHtml } from '../../templateEngine/render-html.js';

/**
 * Express middleware to handle 404 Not Found errors.
 * Renders a custom 404 page using the shared HTML render helper.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @param {Function} [renderHtml=defaultRenderHtml] - Shared HTML render helper.
 */
export default function notFoundHandler(req, res, next, renderHtml = defaultRenderHtml) {
    const html = renderHtml('page/404.njk', {}, req, res);
    res.status(404).send(html);
}
