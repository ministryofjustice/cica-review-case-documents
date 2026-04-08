import createApiJwtToken from '../../service/request/create-api-jwt-token.js';
import { renderHtml as defaultRenderHtml } from '../../templateEngine/render-html.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { formatPageTitle } from '../utils/formatters/index.js';
import { buildImageUrl, buildTextPageLink } from '../utils/link-builders/index.js';
import { fetchPageMetadata } from '../utils/metadata/index.js';
import { determineHighlightAlignmentStrategy } from '../utils/overlap-strategy/index.js';
import { paginationDataFromMetadata } from '../utils/pagination/index.js';

/**
 * Handles the page viewer endpoint.
 * Renders a page view with an image from the associated document.
 *
 * @param {Function} createMetadataServiceFactory - Factory function to create metadata service
 * @param {Function} createPageChunksServiceFactory - Factory function to create document page chunks service
 * @param {Function} [renderHtml=defaultRenderHtml] - Shared HTML render helper.
 * @returns {Function} Express route handler
 */
export function createPageViewerHandler(
    createMetadataServiceFactory,
    createPageChunksServiceFactory,
    renderHtml = defaultRenderHtml
) {
    return async (req, res, next) => {
        try {
            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchTerm = '', align = 'on' } = req.query;
            const apiJwtToken = createApiJwtToken(req.session?.username);

            // Fetch document page metadata from API (which queries OpenSearch)
            let pageMetadata;
            try {
                pageMetadata = await fetchPageMetadata({
                    createMetadataServiceFactory,
                    documentId,
                    pageNumber,
                    crn,
                    jwtToken: apiJwtToken,
                    logger: req.log
                });
            } catch (error) {
                return next(error);
            }

            const viewMode = VIEW_MODES.IMAGE;

            // work out the pagination data from the metadata and values needed to construct the URLs for the pagination links
            const paginationData = paginationDataFromMetadata(
                pageMetadata,
                req.query,
                req.validatedParams,
                viewMode
            );

            const imageUrl = buildImageUrl(documentId, pageNumber, crn);

            // Provide a link for sub-navigation to the text view page for this document page
            const textPageLink = buildTextPageLink(documentId, pageNumber, crn, searchTerm);

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            // Fetch document page chunks with bounding boxes for overlay rendering
            let pageChunks = [];
            try {
                const pageChunksServiceInstance = createPageChunksServiceFactory({
                    documentId,
                    pageNumber,
                    crn,
                    searchTerm,
                    jwtToken: apiJwtToken,
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

            const pageData = {
                documentId,
                pageNumber,
                imageUrl,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                textPageLink,
                pageTitle,
                pageChunks: alignedPageHighlights,
                showPagination: paginationData?.results?.count > 1,
                paginationData
            };
            return res.send(renderHtml('document/page/imageview.njk', pageData, req, res));
        } catch (err) {
            next(err);
        }
    };
}
