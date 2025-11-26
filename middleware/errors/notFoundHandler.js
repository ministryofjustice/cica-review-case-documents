/**
 * Express middleware to handle 404 Not Found errors.
 * Renders a custom 404 error page using the provided template engine service.
 */
import createTemplateEngineService from '../../templateEngine/index.js';

/**
 * Express middleware to handle 404 Not Found errors.
 * Renders a custom 404 page using the provided template engine service.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @param {Object} [templateEngineService=createTemplateEngineService()] - Optional template engine service with a `render` method.
 */
export default function notFoundHandler(
    req,
    res,
    next,
    templateEngineService = createTemplateEngineService()
) {
    const { render } = templateEngineService;
    const html = render('page/404.njk');
    res.status(404).send(html);
}
