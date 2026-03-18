import createApiJwtToken from '../../service/request/create-api-jwt-token.js';
import createTemplateEngineService from '../../templateEngine/index.js';
import { VIEW_MODES } from '../constants/viewModes.js';
import { formatPageTitle } from '../utils/formatters/index.js';
import { buildImagePageLink } from '../utils/link-builders/index.js';
import { fetchPageMetadata } from '../utils/metadata/index.js';
import { paginationDataFromMetadata } from '../utils/pagination/index.js';

/**
 * Handles the text viewer endpoint.
 * Renders a text viewer page displaying OCR text content from document page metadata
 *
 * @param {Function} createMetadataServiceFactory -  Factory that returns a metadata service, that throws an error on invalid or malformed data.
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
            const { searchTerm = '' } = req.query;
            const apiJwtToken = createApiJwtToken(req.session?.username);

            // Fetch document page metadata from OpenSearch via API
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

            const viewMode = VIEW_MODES.TEXT;

            // work out the pagination data from the metadata and values needed to construct the URLs for the pagination links
            const paginationData = paginationDataFromMetadata(
                pageMetadata,
                req.query,
                req.validatedParams,
                viewMode
            );

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            // Provide a link for sub-navigation back to the image page
            const imagePageLink = buildImagePageLink(documentId, pageNumber, crn, searchTerm);

            const { text } = pageMetadata;

            const pageText = text || 'No text content available for this page.'; // TODO: confirm with content team whether this is the desired fallback text when no OCR text is available

            const html = render('document/page/textview.njk', {
                documentId,
                pageNumber,
                caseReferenceNumber: crn,
                caseSelected: req.session?.caseSelected,
                pageType: ['document'],
                csrfToken: res.locals.csrfToken,
                cspNonce: res.locals.cspNonce,
                imagePageLink,
                pageTitle,
                pageText,
                showPagination: paginationData?.results?.count > 1,
                paginationData
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
