import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSegments, findAllMatchingRanges } from './helpers.js';
import { buildTextHighlightSegments } from './index.js';

describe('buildTextHighlightSegments', () => {
    it('treats non-string page text as an empty string', () => {
        const result = buildTextHighlightSegments(null, [
            { chunk_text: 'anything', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [{ text: '', isHighlight: false }]);
    });

    it('returns unhighlighted text when no chunks are provided', () => {
        const result = buildTextHighlightSegments('Example OCR text');

        assert.deepEqual(result, [{ text: 'Example OCR text', isHighlight: false }]);
    });

    it('treats non-array chunks as no matches', () => {
        const result = buildTextHighlightSegments('Example OCR text', null);

        assert.deepEqual(result, [{ text: 'Example OCR text', isHighlight: false }]);
    });

    it('highlights chunk text found in page text', () => {
        const result = buildTextHighlightSegments('The claimant attended on 12/12/1995.', [
            { chunk_text: '12/12/1995', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [
            { text: 'The claimant attended on ', isHighlight: false },
            { text: '12/12/1995', isHighlight: true },
            { text: '.', isHighlight: false }
        ]);
    });

    it('matches chunk text case-insensitively against page text', () => {
        const result = buildTextHighlightSegments('Alpha beta ALPHA', [
            { chunk_text: 'alpha', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [
            { text: 'Alpha', isHighlight: true },
            { text: ' beta ALPHA', isHighlight: false }
        ]);
    });

    it('merges overlapping chunk matches into a single highlighted range', () => {
        const result = buildTextHighlightSegments('ABCDE', [
            { chunk_text: 'ABC', chunk_index: 0 },
            { chunk_text: 'BCD', chunk_index: 1 },
            { chunk_text: 'CDE', chunk_index: 2 }
        ]);

        assert.deepEqual(result, [{ text: 'ABCDE', isHighlight: true }]);
    });

    it('reconstructs original page text from produced segments', () => {
        const pageText = 'The claimant was seen on 12/12/1995 and again on 12/12/1995.';
        const result = buildTextHighlightSegments(pageText, [
            { chunk_text: '12/12/1995 and', chunk_index: 0 },
            { chunk_text: 'and again on 12/12/1995', chunk_index: 1 }
        ]);

        const rebuiltText = result.map((segment) => segment.text).join('');

        assert.equal(rebuiltText, pageText);
    });

    it('matches chunk text when page text contains line breaks and repeated whitespace', () => {
        const pageText = 'Gabapentin 600mg tablets\nAcute   Medication  (Past)';
        const result = buildTextHighlightSegments(pageText, [
            {
                chunk_text: 'Gabapentin 600mg tablets Acute Medication (Past)',
                chunk_index: 0
            }
        ]);

        assert.deepEqual(result, [{ text: pageText, isHighlight: true }]);
    });

    it('does not match when punctuation differs', () => {
        const pageText = 'Acute Medication (Past)';
        const result = buildTextHighlightSegments(pageText, [
            {
                chunk_text: 'Acute Medication Past',
                chunk_index: 0
            }
        ]);

        assert.deepEqual(result, [{ text: pageText, isHighlight: false }]);
    });

    it('matches long chunks when only whitespace differs', () => {
        const pageText =
            'Flexible nasendoscopy\n(E253)\tInsertion of punctal plug\t(C293)\nRigid nasendosopy\t(E253)';
        const result = buildTextHighlightSegments(pageText, [
            {
                chunk_text:
                    'Flexible nasendoscopy (E253) Insertion of punctal plug (C293) Rigid nasendosopy (E253)',
                chunk_index: 0
            }
        ]);

        assert.deepEqual(result, [{ text: pageText, isHighlight: true }]);
    });

    it('ignores chunks that do not appear in page text', () => {
        const result = buildTextHighlightSegments('Visible OCR text', [
            { chunk_text: 'missing phrase', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [{ text: 'Visible OCR text', isHighlight: false }]);
    });

    it('ignores blank chunks safely', () => {
        const result = buildTextHighlightSegments('Visible OCR text', [
            { chunk_text: '   \n\t   ', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [{ text: 'Visible OCR text', isHighlight: false }]);
    });

    it('handles short unmatched chunks safely', () => {
        const result = buildTextHighlightSegments('Visible OCR text', [
            { chunk_text: 'zz', chunk_index: 0 }
        ]);

        assert.deepEqual(result, [{ text: 'Visible OCR text', isHighlight: false }]);
    });
});

describe('highlight helpers', () => {
    it('returns no ranges when source text is empty', () => {
        const result = findAllMatchingRanges('', [{ chunk_text: 'anything', chunk_index: 0 }]);

        assert.deepEqual(result, []);
    });

    it('returns a single empty unhighlighted segment when source text is empty', () => {
        const result = buildSegments('', []);

        assert.deepEqual(result, [{ text: '', isHighlight: false }]);
    });

    it('sorts equal-start ranges by end and keeps separate non-overlapping ranges', () => {
        const result = findAllMatchingRanges('ABCDE FG', [
            { chunk_text: 'AB', chunk_index: 0 },
            { chunk_text: 'ABC', chunk_index: 1 },
            { chunk_text: 'FG', chunk_index: 2 }
        ]);

        assert.deepEqual(result, [
            { start: 0, end: 3 },
            { start: 6, end: 8 }
        ]);
    });
});
