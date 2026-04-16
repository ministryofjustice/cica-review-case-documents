import { buildSegments, findAllMatchingRanges } from './helpers.js';

/**
 * Builds a segment list to be rendered in the text-view template.
 * This is essential as we need to ensure highlighted chunks don't overlap as this would lead to invalid HTML with highlights starting or ending inside another highlighted segment
 *
 * @param {string} pageText - OCR page text shown in text mode
 * @param {Array<{chunk_text: string, chunk_index?: number}>} [chunks=[]] - Chunk matches from search API
 * @returns {Array<{text: string, isHighlight: boolean}>} Segment list in page-text order
 */
export const buildTextHighlightSegments = (pageText, chunks = []) => {
    const sourceText = typeof pageText === 'string' ? pageText : '';
    const matchingRanges = Array.isArray(chunks) ? findAllMatchingRanges(sourceText, chunks) : [];

    return buildSegments(sourceText, matchingRanges);
};
