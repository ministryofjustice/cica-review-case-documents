import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPaginationData, paginationDataFromMetadata } from './pagination.js';

describe('paginationDataFromMetadata', () => {
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    const params = { crn: '12-745678', documentId };

    it('builds default single-page pagination when metadata is missing', () => {
        const result = paginationDataFromMetadata(undefined, {}, params);

        assert.strictEqual(result.results.pages.current, 1);
        assert.strictEqual(result.results.pages.count, 1);
        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].text, 1);
        assert.strictEqual(result.items[0].selected, true);
        assert.strictEqual(
            result.items[0].href,
            `/document/${documentId}/view/page/1?crn=${encodeURIComponent(params.crn)}`
        );
        assert.strictEqual(result.previous, null);
        assert.strictEqual(result.next, null);
    });

    it('includes search query parameters in generated page URLs', () => {
        const result = paginationDataFromMetadata(
            { page_num: 2, page_count: 3 },
            {
                searchTerm: 'acute pain',
                searchResultsPageNumber: '3'
            },
            params
        );

        const firstHref = result.items[0].href;
        const parsed = new URL(firstHref, 'http://localhost');

        assert.strictEqual(parsed.searchParams.get('crn'), '12-745678');
        assert.strictEqual(parsed.searchParams.get('searchTerm'), 'acute pain');
        assert.strictEqual(parsed.searchParams.get('searchResultsPageNumber'), '3');
        assert.strictEqual(result.previous?.text, 'Previous');
        assert.strictEqual(result.next?.text, 'Next');
    });

    it('shows a missing page instead of ellipsis when exactly one page is skipped', () => {
        const result = paginationDataFromMetadata({ page_num: 4, page_count: 5 }, {}, params);

        const itemTexts = result.items.map((item) => item.text);
        assert.deepStrictEqual(itemTexts, [1, 2, 3, 4, 5]);
        assert.strictEqual(
            result.items.some((item) => item.ellipsis === true),
            false
        );
    });

    it('adds ellipses when there are large page gaps', () => {
        const result = paginationDataFromMetadata({ page_num: 5, page_count: 50 }, {}, params);

        const itemTexts = result.items.map((item) => item.text);
        assert.deepStrictEqual(itemTexts, [1, '...', 4, 5, 6, '...', 50]);

        const ellipsisItems = result.items.filter((item) => item.ellipsis);
        assert.strictEqual(ellipsisItems.length, 2);
        assert.strictEqual(ellipsisItems[0].href, null);
        assert.strictEqual(ellipsisItems[1].href, null);
    });

    it('returns correct previous and next links for boundary pages', () => {
        const firstPageResult = paginationDataFromMetadata(
            { page_num: 1, page_count: 5 },
            {},
            params
        );

        assert.strictEqual(firstPageResult.previous, null);
        assert.strictEqual(
            firstPageResult.next?.href,
            `/document/${documentId}/view/page/2?crn=${encodeURIComponent(params.crn)}`
        );

        const lastPageResult = paginationDataFromMetadata(
            { page_num: 5, page_count: 5 },
            {},
            params
        );

        assert.strictEqual(
            lastPageResult.previous?.href,
            `/document/${documentId}/view/page/4?crn=${encodeURIComponent(params.crn)}`
        );
        assert.strictEqual(lastPageResult.next, null);
    });
});

describe('createPaginationData', () => {
    it('builds pagination using a custom URL builder for reuse in other pages', () => {
        const result = createPaginationData({
            currentPageIndex: 2,
            totalPageCount: 4,
            buildPageUrl: (pageNum) => `/future/page/${pageNum}`
        });

        assert.deepStrictEqual(
            result.items.map((item) => item.href),
            ['/future/page/1', '/future/page/2', '/future/page/3', '/future/page/4']
        );
        assert.strictEqual(result.previous?.href, '/future/page/1');
        assert.strictEqual(result.next?.href, '/future/page/3');
    });

    it('defaults to single-page pagination when current/total values are missing', () => {
        const result = createPaginationData({
            buildPageUrl: (pageNum) => `/future/page/${pageNum}`
        });

        assert.strictEqual(result.results.pages.current, 1);
        assert.strictEqual(result.results.pages.count, 1);
        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].href, '/future/page/1');
    });
});
