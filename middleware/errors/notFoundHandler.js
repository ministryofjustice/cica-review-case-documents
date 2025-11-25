import createTemplateEngineService from '../../templateEngine/index.js';

export default function notFoundHandler(req, res, next) {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;

    const html = render('page/404.njk');

    res.status(404).send(html);
}
