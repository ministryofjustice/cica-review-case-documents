import createTemplateEngineService from '../../templateEngine/index.js';

export default function errorHandler(err, req, res, next) {
    const log = req.log || console;
    const status = err.status || err.statusCode || 500;

    // Log the error for debugging
    log.error({ err, status }, 'Application Error');

    // If headers are already sent, delegate to the default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;

    // Render the user-friendly error page
    const html = render('page/error.njk', {
        error: 'Sorry, there is a problem with the service.'
    });

    res.status(status).send(html);
}
