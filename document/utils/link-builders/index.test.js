import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildImagePageLink, buildImageUrl, buildTextPageLink } from './index.js';

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
        it('builds text page link with search context', () => {
            const result = buildTextPageLink(docId, 1, crn, 'search term');
            assert.ok(result.includes(`/document/${docId}/view/text/page/1`));
            assert.ok(result.includes(`crn=${encodeURIComponent(crn)}`));
            assert.ok(result.includes(`searchTerm=${encodeURIComponent('search term')}`));
        });

        it('handles empty search parameters', () => {
            const result = buildTextPageLink(docId, 1, crn);
            assert.ok(result.includes(`/document/${docId}/view/text/page/1`));
            assert.ok(result.includes('searchTerm='));
        });

        it('encodes special characters in search term', () => {
            const result = buildTextPageLink(docId, 1, crn, 'test & special');
            assert.ok(result.includes(encodeURIComponent('test & special')));
        });
    });

    describe('buildImagePageLink', () => {
        it('builds image page link with search context', () => {
            const result = buildImagePageLink(docId, 1, crn, 'search term');
            assert.ok(result.includes(`/document/${docId}/view/page/1`));
            assert.ok(result.includes(`crn=${encodeURIComponent(crn)}`));
            assert.ok(result.includes(`searchTerm=${encodeURIComponent('search term')}`));
        });

        it('handles empty search parameters', () => {
            const result = buildImagePageLink(docId, 1, crn);
            assert.ok(result.includes(`/document/${docId}/view/page/1`));
            assert.ok(result.includes('searchTerm='));
        });
    });
});
