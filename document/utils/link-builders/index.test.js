import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SEARCH_TYPE } from '../../../api/search/constants/searchTypes.js';
import { buildImagePageLink, buildImageUrl, buildTextPageLink } from './index.js';

describe('Link Builders', () => {
    const docId = '123e4567-e89b-12d3-a456-426614174000';
    const crn = '12-745678';

    describe('buildImageUrl', () => {
        it('builds image URL correctly', () => {
            const result = buildImageUrl(docId, 1, crn);
            assert.strictEqual(
                result,
                `/document/${docId}/page/1?crn=${crn}&type=${DEFAULT_SEARCH_TYPE}`
            );
        });

        it('handles different page numbers', () => {
            const result = buildImageUrl(docId, 42, crn);
            assert.strictEqual(
                result,
                `/document/${docId}/page/42?crn=${crn}&type=${DEFAULT_SEARCH_TYPE}`
            );
        });

        it('appends type when searchType is provided', () => {
            const result = buildImageUrl(docId, 1, crn, 'keyword');
            assert.strictEqual(result, `/document/${docId}/page/1?crn=${crn}&type=keyword`);
        });

        it('defaults to DEFAULT_SEARCH_TYPE when searchType is not provided', () => {
            const result = buildImageUrl(docId, 1, crn);
            assert.ok(result.includes(`&type=${DEFAULT_SEARCH_TYPE}`));
        });

        it('defaults to DEFAULT_SEARCH_TYPE when searchType is undefined', () => {
            const result = buildImageUrl(docId, 1, crn, undefined);
            assert.strictEqual(
                result,
                `/document/${docId}/page/1?crn=${crn}&type=${DEFAULT_SEARCH_TYPE}`
            );
        });

        it('defaults to DEFAULT_SEARCH_TYPE when searchType is invalid', () => {
            const result = buildImageUrl(docId, 1, crn, 'invalid-type');
            assert.strictEqual(
                result,
                `/document/${docId}/page/1?crn=${crn}&type=${DEFAULT_SEARCH_TYPE}`
            );
        });

        it('defaults to DEFAULT_SEARCH_TYPE when searchType is empty string', () => {
            const result = buildImageUrl(docId, 1, crn, '');
            assert.strictEqual(
                result,
                `/document/${docId}/page/1?crn=${crn}&type=${DEFAULT_SEARCH_TYPE}`
            );
        });

        it('uses session feature-flag type when searchType is invalid and session override is set', () => {
            const session = { featureFlags: { type: 'semantic' } };
            const result = buildImageUrl(docId, 1, crn, 'invalid-type', session);
            assert.ok(result.includes('&type=semantic'));
        });

        it('falls back to DEFAULT_SEARCH_TYPE when searchType is invalid and session has no type flag', () => {
            const result = buildImageUrl(docId, 1, crn, 'invalid-type', {});
            assert.ok(result.includes(`&type=${DEFAULT_SEARCH_TYPE}`));
        });

        it('appends type when searchType is provided', () => {
            const result = buildImageUrl(docId, 1, crn, 'keyword');
            assert.strictEqual(result, `/document/${docId}/page/1?crn=${crn}&type=keyword`);
        });

        it('omits type when searchType is empty', () => {
            const result = buildImageUrl(docId, 1, crn, '');
            assert.strictEqual(result, `/document/${docId}/page/1?crn=${crn}`);
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

        it('appends type when searchType is provided', () => {
            const result = buildTextPageLink(docId, 1, crn, 'foo', 'hybrid-dates');
            assert.ok(result.includes('&type=hybrid-dates'));
        });

        it('omits type when searchType is empty', () => {
            const result = buildTextPageLink(docId, 1, crn, 'foo');
            assert.ok(!result.includes('type='));
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

        it('appends type when searchType is provided', () => {
            const result = buildImagePageLink(docId, 1, crn, 'foo', 'hybrid-dates');
            assert.ok(result.includes('&type=hybrid-dates'));
        });

        it('omits type when searchType is empty', () => {
            const result = buildImagePageLink(docId, 1, crn, 'foo');
            assert.ok(!result.includes('type='));
        });
    });
});
