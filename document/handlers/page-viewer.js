import createTemplateEngineService from '../../templateEngine/index.js';
import { formatPageTitle } from '../utils/formatters/index.js';
import { buildBackLink, buildImageUrl, buildTextPageLink } from '../utils/link-builders/index.js';
import { determineHighlightAlignmentStrategy } from '../utils/overlap-strategy/index.js';
import { paginationDataFromMetadata } from '../utils/pagination/index.js';

/**
 * Handles the page viewer endpoint.
 * Renders a page view with an image from the associated document.
 *
 * @param {Function} createMetadataServiceFactory - Factory function to create metadata service
 * @param {Function} createPageChunksServiceFactory - Factory function to create document page chunks service
 * @param {Function} [createTemplateEngineServiceFactory=createTemplateEngineService] - Factory that returns a template engine service with a render method
 * @returns {Function} Express route handler
 */
export function createPageViewerHandler(
    createMetadataServiceFactory,
    createPageChunksServiceFactory,
    createTemplateEngineServiceFactory = createTemplateEngineService
) {
    return async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineServiceFactory();
            const { render } = templateEngineService;

            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchResultsPageNumber = '', searchTerm = '', align = 'on' } = req.query;

            // Fetch document page metadata from API (which queries OpenSearch)
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

            // work out the pagination data from the metadata and values needed to construct the URLs for the pagination links
            const paginationData = paginationDataFromMetadata(
                pageMetadata,
                req.query,
                req.validatedParams
            );

            const imageUrl = buildImageUrl(documentId, pageNumber, crn);

            // Provide a link for sub-navigation to the text view page for this document page
            const textPageLink = buildTextPageLink(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                searchResultsPageNumber
            );

            const backLink = buildBackLink(searchTerm, searchResultsPageNumber, crn);

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            // Fetch document page chunks with bounding boxes for overlay rendering
            let pageChunks = [];
            try {
                const pageChunksServiceInstance = createPageChunksServiceFactory({
                    documentId,
                    pageNumber,
                    crn,
                    searchTerm,
                    jwtToken: req.cookies?.jwtToken,
                    logger: req.log
                });
                pageChunks = await pageChunksServiceInstance.getPageChunks();
            } catch (error) {
                // Chunks are core functionality - capture error to display to user
                req.log?.error(
                    { error: error.message, documentId, pageNumber, searchTerm },
                    'Failed to retrieve document page chunks'
                );
                return next(error);
            }

            const alignedPageHighlights = determineHighlightAlignmentStrategy(align, pageChunks);

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
                pageTitle,
                pageChunks: alignedPageHighlights,
                showPagination: paginationData?.results?.count > 1,
                paginationData
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
