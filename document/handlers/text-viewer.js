import createTemplateEngineService from '../../templateEngine/index.js';
import { formatPageTitle } from '../utils/formatters/index.js';
import { buildBackLink, buildImagePageLink } from '../utils/link-builders/index.js';

/**
 * Handles the text viewer endpoint.
 * Renders a text viewer page displaying OCR text content from document page metadata
 *
 * @param {Function} createMetadataServiceFactory - Factory that returns a metadata service
 * @param {Function} [createTemplateEngineServiceFactory=createTemplateEngineService] - Factory that returns a template engine service with a render method
 * @returns {Function} Express route handler
 */
export function createTextViewerHandler(
    createMetadataServiceFactory,
    createTemplateEngineServiceFactory = createTemplateEngineService
) {
    return async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineServiceFactory();
            const { render } = templateEngineService;

            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchResultsPageNumber = '1', searchTerm = '' } = req.query;

            // Fetch document page metadata from OpenSearch via API
            let pageMetadata;
            try {
                const metadataService = createMetadataServiceFactory({
                    documentId,
                    pageNumber,
                    crn,
                    jwtToken: req.cookies?.jwtToken,
                    logger: req.log
                });
                pageMetadata = await metadataService.getPageMetadata();
            } catch (error) {
                req.log?.error(
                    { error: error.message, documentId, pageNumber },
                    'Failed to retrieve page metadata from API'
                );
                return next(error);
            }

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            // Provide a link for sub-navigation back to the image page
            const imagePageLink = buildImagePageLink(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                searchResultsPageNumber
            );

            const backLink = buildBackLink(searchTerm, searchResultsPageNumber, crn);

            const { text } = pageMetadata;

            const pageText = text || 'No text content available for this page.';

            const html = render('document/page/textview.njk', {
                documentId,
                pageNumber,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                imagePageLink,
                backLink,
                pageTitle,
                pageText
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
