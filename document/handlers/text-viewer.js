import createTemplateEngineService from '../../templateEngine/index.js';
import { buildBackLink, buildImagePageLink } from '../utils/link-builders/index.js';

/**
 * Handles the text viewer endpoint.
 * Renders a placeholder text view page with navigation back to image view.
 *
 * @returns {Function} Express route handler
 */
export function createTextViewerHandler() {
    return async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchResultsPageNumber = '1', searchTerm = '' } = req.query;

            const imagePageLink = buildImagePageLink(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                searchResultsPageNumber
            );
            const backLink = buildBackLink(searchTerm, searchResultsPageNumber, crn);

            const html = render('document/page/textview.njk', {
                documentId,
                pageNumber,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                imagePageLink,
                backLink
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
