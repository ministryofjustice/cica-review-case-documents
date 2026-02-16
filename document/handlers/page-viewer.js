import createTemplateEngineService from '../../templateEngine/index.js';
import { formatPageTitle } from '../utils/formatters/index.js';
import { buildBackLink, buildImageUrl, buildTextPageLink } from '../utils/link-builders/index.js';
import { paginationDataFromMetadata } from '../utils/pagination/index.js';

/**
 * Calculates edge coordinates from a bounding box.
 *
 * @param {{top?: number|string, left?: number|string, height?: number|string, width?: number|string}|undefined} box - Bounding box values
 * @returns {{top: number, left: number, height: number, width: number, bottom: number, right: number}} Parsed edges
 */
const getBoxEdges = (box) => ({
    top: Number(box?.top || 0),
    left: Number(box?.left || 0),
    height: Number(box?.height || 0),
    width: Number(box?.width || 0),
    bottom: Number(box?.top || 0) + Number(box?.height || 0),
    right: Number(box?.left || 0) + Number(box?.width || 0)
});

/**
 * Determines whether one box is fully inside another.
 *
 * @param {{top: number, bottom: number, left: number, right: number}} inner - Candidate inner box edges
 * @param {{top: number, bottom: number, left: number, right: number}} outer - Candidate outer box edges
 * @returns {boolean} True when inner is fully bounded by outer
 */
const isInsideBox = (inner, outer) =>
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom &&
    inner.left >= outer.left &&
    inner.right <= outer.right;

/**
 * Determines whether one box is vertically contained inside another.
 *
 * @param {{top: number, bottom: number}} inner - Candidate inner box edges
 * @param {{top: number, bottom: number}} outer - Candidate outer box edges
 * @returns {boolean} True when inner top and bottom are within outer bounds
 */
const isVerticallyContained = (inner, outer) =>
    inner.top >= outer.top && inner.bottom <= outer.bottom;

/**
 * Determines whether two boxes overlap horizontally.
 *
 * @param {{left: number, right: number}} a - First box horizontal edges
 * @param {{left: number, right: number}} b - Second box horizontal edges
 * @returns {boolean} True when horizontal ranges overlap
 */
export const hasHorizontalOverlap = (a, b) => a.left < b.right && a.right > b.left;

/*
UI rules for handling overlapping chunks:
a) chunk 1 has top at 1% and is 3% high, chunk 2 top at 4% and is 4% high, chunk 3 top at 7% and is 4% high : change chunk 3 to start at (chunk2-top + chunk2-high) and make it height-((chunk2-top + chunk2-high) - chunk3-top) so this would be start at 8 and be 3% high.
b) if chunk 3 top, bottom, left, right are all inside chunk 2, don't show it
c) if chunk 3 is vertically contained within chunk 2 but is wider, then expand chunk 2 to encompass chunk 3, chunk 3 can now be hidden
*/
/**
 * Applies overlap rules to page chunks before rendering overlays.
 *
 * @param {Array<{bounding_box?: {top?: number, left?: number, width?: number, height?: number}}>} [chunks=[]] - Raw OCR chunks
 * @returns {Array<object>} Normalised chunks with overlaps resolved
 */
export const checkOverlappingChunks = (chunks = []) => {
    const output = [];

    for (const chunk of chunks) {
        const currentChunk = {
            ...chunk,
            bounding_box: chunk?.bounding_box ? { ...chunk.bounding_box } : chunk?.bounding_box
        };

        if (!currentChunk?.bounding_box) {
            output.push(currentChunk);
            continue;
        }

        let currentEdges = getBoxEdges(currentChunk.bounding_box);
        let shouldHideChunk = false;

        for (const previousChunk of output) {
            if (!previousChunk?.bounding_box) {
                continue;
            }

            const previousEdges = getBoxEdges(previousChunk.bounding_box);

            if (isInsideBox(currentEdges, previousEdges)) {
                shouldHideChunk = true;
                break;
            }

            if (isVerticallyContained(currentEdges, previousEdges)) {
                const mergedLeft = Math.min(previousEdges.left, currentEdges.left);
                const mergedRight = Math.max(previousEdges.right, currentEdges.right);
                previousChunk.bounding_box.left = mergedLeft;
                previousChunk.bounding_box.width = mergedRight - mergedLeft;
                shouldHideChunk = true;
                break;
            }

            if (!hasHorizontalOverlap(currentEdges, previousEdges)) {
                continue;
            }

            const overlapsVertically =
                currentEdges.top < previousEdges.bottom &&
                currentEdges.bottom > previousEdges.bottom;

            if (overlapsVertically) {
                const nextTop = previousEdges.bottom;
                const nextHeight = currentEdges.bottom - nextTop;

                currentChunk.bounding_box.top = nextTop;
                currentChunk.bounding_box.height = Math.max(0, nextHeight);
                currentEdges = getBoxEdges(currentChunk.bounding_box);
            }
        }

        if (shouldHideChunk) {
            continue;
        }

        if (Number(currentChunk.bounding_box.height) <= 0) {
            continue;
        }

        output.push(currentChunk);
    }

    return output;
};

/**
 * Resolves which chunk strategy should be used for rendering.
 *
 * @param {string} align - Query flag controlling chunk alignment strategy
 * @param {Array<object>} [pageChunks=[]] - Raw page chunks from the page chunks service
 * @returns {Array<object>} Processed or original chunks based on align flag
 */
export const resolveChunkStrategy = (align, pageChunks = []) =>
    align === 'on' ? checkOverlappingChunks(pageChunks) : pageChunks;

/**
 * Handles the page viewer endpoint.
 * Renders a page view with an image from the associated document.
 *
 * @param {Function} createMetadataServiceFactory - Factory function to create metadata service
 * @param {Function} createPageChunksServiceFactory - Factory function to create document page chunks service
 * @returns {Function} Express route handler
 */
export function createPageViewerHandler(
    createMetadataServiceFactory,
    createPageChunksServiceFactory
) {
    return async (req, res, next) => {
        try {
            const templateEngineService = createTemplateEngineService();
            const { render } = templateEngineService;

            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;
            const { searchResultsPageNumber = '', searchTerm = '', align = 'off' } = req.query;

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

            const chunkStrategy = resolveChunkStrategy(align, pageChunks);

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
                pageChunks: chunkStrategy,
                showPagination: paginationData?.results?.count > 1,
                paginationData
            });

            return res.send(html);
        } catch (err) {
            next(err);
        }
    };
}
