import createTemplateEngineService from './index.js';

/**
 * Renders a template to an HTML string using shared request and response data.
 *
 * @param {string} templatePath - Template path relative to the configured template roots.
 * @param {object} [pageData={}] - Page-specific data passed to the template.
 * @param {import('express').Request} [req] - Express request object for session-backed values.
 * @param {import('express').Response} [res] - Express response object for shared locals.
 * @returns {string} Rendered HTML string.
 */
export function renderHtml(templatePath, pageData = {}, req, res) {
    const templateEngineService = createTemplateEngineService();
    const sharedData = {
        ...(res?.locals || {}),
        userName: req?.session?.username
    };

    return templateEngineService.render(templatePath, {
        ...sharedData,
        ...pageData
    });
}
