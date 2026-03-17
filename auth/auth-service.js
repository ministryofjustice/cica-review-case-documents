import createTemplateEngineService from '../templateEngine/index.js';

/**
 * Signs out the current user by destroying their session,
 * resetting the rate limiter key if applicable, and rendering the sign-out page.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {Function} next - The next middleware function.
 */
export function signOutUser(req, res, next) {
    const caseReferenceNumber = req.session?.caseReferenceNumber;

    req.session.destroy(() => {
        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/sign-out.njk', {
            message: 'You have signed out',
            caseReferenceNumber
        });
        res.send(html);
    });
}
