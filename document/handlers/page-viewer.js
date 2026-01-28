import createTemplateEngineService from '../../templateEngine/index.js';
import { formatPageTitle } from '../utils/formatters.js';
import { buildBackLink, buildImageUrl, buildTextPageLink } from '../utils/link-builders.js';

/**
 * Handles the page viewer endpoint.
 * Renders a page view with an image from the associated document.
 *
 * @param {Function} createMetadataService - Factory function to create metadata service
 * @returns {Function} Express route handler
 */
export function createPageViewerHandler(createMetadataService) {
    return async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchResultsPageNumber = '', searchTerm = '' } = req.query;

            // Fetch document page metadata from API (which queries OpenSearch)
            let pageMetadata;
            try {
                const metadataService = createMetadataService({
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

            const imageUrl = buildImageUrl(documentId, pageNumber, crn);
            const textPageLink = buildTextPageLink(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                searchResultsPageNumber
            );
            const backLink = buildBackLink(searchTerm, searchResultsPageNumber, crn);

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            const html = render('document/page/imageview.njk', {
                documentId,
                pageNumber,
                imageUrl,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                textPageLink,
                backLink,
                pageTitle
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
