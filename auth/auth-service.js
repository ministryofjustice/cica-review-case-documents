import createTemplateEngineService from '../templateEngine/index.js';

/**
 * Signs out the current user by destroying their session and rendering the sign-out page.
 *
 * @export
 * @param {import('express').Request} req Express request object.
 * @param {import('express').Response} res Express response object.
 */
export function signOutUser(req, res) {
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
