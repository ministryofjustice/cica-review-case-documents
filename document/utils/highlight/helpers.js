/**
 * Escapes regex metacharacters so chunk terms are matched literally.
 *
 * @param {string} value - Raw chunk term
 * @returns {string} Regex-safe literal text
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds a regex for whole-string chunk matching with flexible whitespace.
 *
 * @param {string} chunkText - Raw chunk text
 * @returns {RegExp|null} Regex for the chunk, or `null` when the chunk is blank
 */
const createChunkRegex = (chunkText) => {
    const chunkTerms = chunkText.trim().split(/\s+/u).filter(Boolean);
    if (chunkTerms.length === 0) {
        return null;
    }

    return new RegExp(chunkTerms.map(escapeRegExp).join('\\s+'), 'iu');
};

/**
 * Converts a regex match into a source-text range.
 *
 * @param {RegExpMatchArray|null} match - Regex match result
 * @param {number} [offset=0] - Offset to add to the match position
 * @returns {{start: number, end: number}|null} Source range, or `null` when no match is found
 */
const toMatchRange = (match, offset = 0) => {
    if (!match || typeof match.index !== 'number') {
        return null;
    }

    return {
        start: offset + match.index,
        end: offset + match.index + match[0].length
    };
};

/**
 * Finds the next chunk match in original source text, preferring matches at or after the current cursor.
 *
 * @param {string} sourceText - Original page text
 * @param {string} chunkText - Raw chunk text
 * @param {number} searchCursor - Preferred search offset in the page text
 * @returns {{start: number, end: number}|null} Source range, or `null` when no match is found
 */
const findChunkMatchRange = (sourceText, chunkText, searchCursor) => {
    const chunkRegex = createChunkRegex(chunkText);
    if (!chunkRegex) {
        return null;
    }

    return (
        toMatchRange(sourceText.slice(searchCursor).match(chunkRegex), searchCursor) ??
        toMatchRange(sourceText.match(chunkRegex))
    );
};

/**
 * Merges overlapping source ranges into a minimal non-overlapping set.
 *
 * @param {Array<{start: number, end: number}>} ranges - Source ranges to merge
 * @returns {Array<{start: number, end: number}>} Merged ranges in ascending order
 */
const mergeOverlappingRanges = (ranges) => {
    if (ranges.length === 0) {
        return [];
    }

    const sortedRanges = ranges.toSorted((leftRange, rightRange) => {
        if (leftRange.start !== rightRange.start) {
            return leftRange.start - rightRange.start;
        }

        return leftRange.end - rightRange.end;
    });

    const mergedRanges = [{ ...sortedRanges[0] }];

    for (let rangeIndex = 1; rangeIndex < sortedRanges.length; rangeIndex += 1) {
        const currentRange = sortedRanges[rangeIndex];
        const previousRange = mergedRanges[mergedRanges.length - 1];

        if (currentRange.start <= previousRange.end) {
            previousRange.end = Math.max(previousRange.end, currentRange.end);
            continue;
        }

        mergedRanges.push({ ...currentRange });
    }

    return mergedRanges;
};

/**
 * Finds chunk matches in source text and returns merged source ranges.
 *
 * @param {string} sourceText - Original OCR text
 * @param {Array<{chunk_text?: string}>} chunks - Chunks to check in incoming order
 * @returns {Array<{start: number, end: number}>} Merged source ranges for highlights
 */
export const findAllMatchingRanges = (sourceText, chunks) => {
    if (sourceText.length === 0) {
        return [];
    }

    const matchedSourceRanges = [];
    let searchCursor = 0;

    for (const chunk of chunks) {
        const chunkText = typeof chunk?.chunk_text === 'string' ? chunk.chunk_text : '';
        const matchRange = findChunkMatchRange(sourceText, chunkText, searchCursor);
        if (!matchRange) {
            continue;
        }

        matchedSourceRanges.push(matchRange);

        searchCursor = Math.max(searchCursor, matchRange.end);
    }

    return mergeOverlappingRanges(matchedSourceRanges);
};

/**
 * Builds presentation segments from highlighted source ranges.
 *
 * @param {string} sourceText - Original OCR text
 * @param {Array<{start: number, end: number}>} ranges - Highlight ranges in source text
 * @returns {Array<{text: string, isHighlight: boolean}>} Ordered render segments
 */
export const buildSegments = (sourceText, ranges) => {
    if (sourceText.length === 0) {
        return [{ text: '', isHighlight: false }];
    }

    const segments = [];
    let cursor = 0;

    for (const range of ranges) {
        if (range.start > cursor) {
            segments.push({
                text: sourceText.slice(cursor, range.start),
                isHighlight: false
            });
        }

        if (range.end > range.start) {
            segments.push({
                text: sourceText.slice(range.start, range.end),
                isHighlight: true
            });
        }

        cursor = Math.max(cursor, range.end);
    }

    if (cursor < sourceText.length) {
        segments.push({
            text: sourceText.slice(cursor),
            isHighlight: false
        });
    }

    return segments.filter((segment) => segment.text.length > 0);
};
