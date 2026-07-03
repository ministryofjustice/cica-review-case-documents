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

/**
 * Clones a highlight chunk and its bounding box to avoid mutating original input.
 *
 * @param {{bounding_box?: {top?: number, left?: number, width?: number, height?: number}}} highlight - Highlight chunk to clone.
 * @returns {{bounding_box?: {top?: number, left?: number, width?: number, height?: number}} & object} Cloned highlight chunk.
 */
const cloneHighlightChunk = (highlight) => ({
    ...highlight,
    bounding_box: highlight?.bounding_box ? { ...highlight.bounding_box } : highlight?.bounding_box
});

/**
 * Applies overlap rules for one current chunk against previously accepted chunks.
 *
 * @param {{bounding_box: {top?: number, left?: number, width?: number, height?: number}} & object} currentChunk - Current highlight chunk being processed.
 * @param {Array<{bounding_box?: {top?: number, left?: number, width?: number, height?: number}} & object>} output - Previously accepted highlight chunks.
 * @returns {{shouldHideChunk: boolean, currentEdges: {top: number, left: number, height: number, width: number, bottom: number, right: number}}} Rule evaluation result.
 */
function applyOverlapRules(currentChunk, output) {
    let currentEdges = getBoxEdges(currentChunk.bounding_box);

    for (const previousChunk of output) {
        if (!previousChunk?.bounding_box) {
            continue;
        }

        const previousEdges = getBoxEdges(previousChunk.bounding_box);

        if (isInsideBox(currentEdges, previousEdges)) {
            return { shouldHideChunk: true, currentEdges };
        }

        if (
            isVerticallyContained(currentEdges, previousEdges) &&
            hasHorizontalOverlap(currentEdges, previousEdges)
        ) {
            const mergedLeft = Math.min(previousEdges.left, currentEdges.left);
            const mergedRight = Math.max(previousEdges.right, currentEdges.right);
            previousChunk.bounding_box.left = mergedLeft;
            previousChunk.bounding_box.width = mergedRight - mergedLeft;
            return { shouldHideChunk: true, currentEdges };
        }

        if (!hasHorizontalOverlap(currentEdges, previousEdges)) {
            continue;
        }

        const overlapsVertically =
            currentEdges.top < previousEdges.bottom && currentEdges.bottom > previousEdges.bottom;

        if (!overlapsVertically) {
            continue;
        }

        const nextTop = previousEdges.bottom;
        const nextHeight = currentEdges.bottom - nextTop;
        currentChunk.bounding_box.top = nextTop;
        currentChunk.bounding_box.height = Math.max(0, nextHeight);
        currentEdges = getBoxEdges(currentChunk.bounding_box);
    }

    return { shouldHideChunk: false, currentEdges };
}

/**
 * Applies overlap rules to highlighted areas before rendering overlays.
 *
 * @param {Array<{bounding_box?: {top?: number, left?: number, width?: number, height?: number}}>} [highlights=[]] - Raw highlighted areas from OCR chunks
 * @returns {Array<object>} Normalised highlighted areas with overlaps resolved
 */
export const alignOverlappingHighlights = (highlights = []) => {
    const output = [];

    for (const highlight of highlights) {
        const currentChunk = cloneHighlightChunk(highlight);

        if (!currentChunk?.bounding_box) {
            output.push(currentChunk);
            continue;
        }

        const { shouldHideChunk } = applyOverlapRules(currentChunk, output);

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
 * Resolves whether highlight overlap alignment should be applied.
 *
 * @param {boolean} align - Feature flag controlling highlight alignment
 * @param {Array<object>} [highlights=[]] - Raw highlighted areas from the page chunks service
 * @returns {Array<object>} Processed or original highlighted areas based on align flag
 */
export const determineHighlightAlignmentStrategy = (align, highlights = []) =>
    align ? alignOverlappingHighlights(highlights) : highlights;
