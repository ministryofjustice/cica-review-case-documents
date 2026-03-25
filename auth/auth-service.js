import createTemplateEngineService from '../templateEngine/index.js';

/**
 * Signs out the current user by destroying their session and rendering the sign-out page.
 *
 * @export
 * @param {import('express').Request} req Express request object.
 * @param {import('express').Response} res Express response object.
 * @param {import('express').NextFunction} next Express next middleware function.
 */
export function signOutUser(req, res, next) {
    const caseReferenceNumber = req.session?.caseReferenceNumber;

    req.session.destroy((err) => {
        if (err) {
            req.log?.error({ err }, 'Session destruction failed');
            return next(err);
        }

        const templateEngineService = createTemplateEngineService();
        const { render } = templateEngineService;
        const html = render('index/sign-out.njk', {
            message: 'You have signed out',
            caseReferenceNumber
        });
        res.send(html);
    });
}
