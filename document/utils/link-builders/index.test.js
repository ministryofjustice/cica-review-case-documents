import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBackLink, buildImagePageLink, buildImageUrl, buildTextPageLink } from './index.js';

describe('Link Builders', () => {
    const docId = '123e4567-e89b-12d3-a456-426614174000';
    const crn = '12-745678';

    describe('buildImageUrl', () => {
        it('builds image URL correctly', () => {
            const result = buildImageUrl(docId, 1, crn);
            assert.strictEqual(result, `/document/${docId}/page/1?crn=${crn}`);
        });

        it('handles different page numbers', () => {
            const result = buildImageUrl(docId, 42, crn);
            assert.strictEqual(result, `/document/${docId}/page/42?crn=${crn}`);
        });
    });

    describe('buildTextPageLink', () => {
        it('builds text page link with all parameters', () => {
            const result = buildTextPageLink(docId, 1, crn, 'search term', '2');
            assert.ok(result.includes(`/document/${docId}/view/text/page/1`));
            assert.ok(result.includes(`crn=${encodeURIComponent(crn)}`));
            assert.ok(result.includes(`searchTerm=${encodeURIComponent('search term')}`));
            assert.ok(result.includes('searchResultsPageNumber=2'));
        });

        it('handles empty search parameters', () => {
            const result = buildTextPageLink(docId, 1, crn);
            assert.ok(result.includes(`/document/${docId}/view/text/page/1`));
            assert.ok(result.includes('searchTerm='));
            assert.ok(result.includes('searchResultsPageNumber='));
        });

        it('encodes special characters in search term', () => {
            const result = buildTextPageLink(docId, 1, crn, 'test & special', '1');
            assert.ok(result.includes(encodeURIComponent('test & special')));
        });
    });

    describe('buildImagePageLink', () => {
        it('builds image page link with all parameters', () => {
            const result = buildImagePageLink(docId, 1, crn, 'search term', '2');
            assert.ok(result.includes(`/document/${docId}/view/page/1`));
            assert.ok(result.includes(`crn=${encodeURIComponent(crn)}`));
            assert.ok(result.includes(`searchTerm=${encodeURIComponent('search term')}`));
            assert.ok(result.includes('searchResultsPageNumber=2'));
        });

        it('handles empty search parameters', () => {
            const result = buildImagePageLink(docId, 1, crn);
            assert.ok(result.includes(`/document/${docId}/view/page/1`));
            assert.ok(result.includes('searchTerm='));
            assert.ok(result.includes('searchResultsPageNumber='));
        });
    });

    describe('buildBackLink', () => {
        it('returns /search when no search term provided', () => {
            const result = buildBackLink('', '', crn);
            assert.strictEqual(result, '/search');
        });

        it('returns /search when search term is empty string', () => {
            const result = buildBackLink('');
            assert.strictEqual(result, '/search');
        });

        it('builds search results link with search parameters', () => {
            const result = buildBackLink('test query', '2', crn);
            assert.ok(result.includes('/search?'));
            assert.ok(result.includes(`query=${encodeURIComponent('test query')}`));
            assert.ok(result.includes('pageNumber=2'));
            assert.ok(result.includes(`crn=${encodeURIComponent(crn)}`));
        });

        it('encodes special characters in search term and CRN', () => {
            const result = buildBackLink('search & filter', '1', 'CASE-2024');
            assert.ok(result.includes(encodeURIComponent('search & filter')));
            assert.ok(result.includes(encodeURIComponent('CASE-2024')));
        });
    });
});
