import { ifDebugContext } from '../../middleware/debug/index.js';
import { getFeatureFlagValue } from '../../middleware/featureFlags/index.js';
import createApiJwtToken from '../../service/request/create-api-jwt-token.js';
import buildViewModel from '../../templateEngine/buildViewModel.js';
import createTemplateEngineService from '../../templateEngine/index.js';
import buildSearchSessionPreference from '../../utils/buildSearchSessionPreference.js';
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
            const { searchTerm = '' } = req.query;
            const searchType = getFeatureFlagValue(req.session, 'type');
            const alignFlag = getFeatureFlagValue(req.session, 'align');
            const userName = req.session?.username;
            const apiJwtToken = createApiJwtToken(userName);
            const debugQueryDslOverrides = res.locals.debugQueryDslOverrides || {};

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
                viewMode,
                searchType
            );

            const imageUrl = buildImageUrl(documentId, pageNumber, crn, searchType, req.session);

            // Provide a link for sub-navigation to the text view page for this document page
            const textPageLink = buildTextPageLink(
                documentId,
                pageNumber,
                crn,
                searchTerm,
                searchType,
                req.session
            );

            const pageTitle = formatPageTitle(pageMetadata.correspondence_type);

            // Fetch document page chunks with bounding boxes for overlay rendering
            let pageChunks = [];
            try {
                const pageChunksServiceInstance = createPageChunksServiceFactory({
                    documentId,
                    pageNumber,
                    crn,
                    searchTerm,
                    searchType,
                    jwtToken: apiJwtToken,
                    queryDslConfig: debugQueryDslOverrides,
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

            const alignedPageHighlights = determineHighlightAlignmentStrategy(
                alignFlag,
                pageChunks
            );

            // Populate debug info with document data when debug context is present.
            ifDebugContext(res, (debugInfo) => {
                debugInfo.document = {
                    documentId,
                    pageNumber,
                    pageMetadata: {
                        correspondenceType: pageMetadata?.correspondence_type,
                        totalPages: pageMetadata?.total_pages
                    },
                    highlightsCount: pageChunks?.length || 0,
                    chunksAligned: alignFlag
                };
                debugInfo.search = {
                    ...debugInfo.search,
                    opensearch: {
                        ...(debugInfo.search?.opensearch || {}),
                        index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME || 'unknown',
                        preference: buildSearchSessionPreference(String(searchTerm))
                    }
                };
            });

            const html = render(
                'document/page/imageview.njk',
                buildViewModel(req, res, {
                    documentId,
                    pageNumber,
                    imageUrl,
                    pageType: ['document'],
                    textPageLink,
                    pageTitle,
                    pageChunks: alignedPageHighlights,
                    showPagination: paginationData?.results?.count > 1,
                    paginationData
                })
            );

            if (typeof res.locals?.finalizeDebugInfo === 'function') {
                res.locals.finalizeDebugInfo({ responseStatus: 200 });
            }

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
