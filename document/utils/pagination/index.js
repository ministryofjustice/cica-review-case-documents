/*
  Expected pagination patterns:
  [1] 2 ... 50 Next ->
  <- Previous 1 [2] 3 ... 50 Next ->
  <- Previous 1 2 [3] 4 ... 50 Next ->
  <- Previous 1 2 3 [4] 5 ... 50 Next ->
  <- Previous 1 ... 4 [5] 6 ... 50 Next ->
  <- Previous 1 ... 47 [48] 49 50 Next ->
  <- Previous 1 ... 48 [49] 50 Next ->
  <- Previous 1 ... 49 [50]
*/

/**
 * Calculates the page numbers to display around the current page.
 * Always includes first and last page, plus a window around current page.
 *
 * @param {object} options - Pagination window options.
 * @param {number} options.currentPageIndex - Current 1-based page index.
 * @param {number} options.totalPageCount - Total number of pages.
 * @param {number} [options.windowSize=1] - Number of pages to show either side of current page.
 * @returns {number[]} Sorted list of visible page numbers.
 */
const getVisiblePages = ({ currentPageIndex, totalPageCount, windowSize = 1 }) => {
    const pages = new Set([1]);

    for (
        let page = Math.max(1, currentPageIndex - windowSize);
        page <= Math.min(totalPageCount, currentPageIndex + windowSize);
        page++
    ) {
        pages.add(page);
    }

    if (totalPageCount > 1) {
        pages.add(totalPageCount);
    }

    return Array.from(pages).sort((a, b) => a - b);
};

/**
 * Builds pagination items (page links and ellipsis markers) for the MoJ pagination macro.
 *
 * @param {object} options - Item builder options.
 * @param {number[]} options.visiblePages - Sorted list of visible page numbers.
 * @param {number} options.currentPageIndex - Current 1-based page index.
 * @param {(pageNum: number) => string} options.buildPageUrl - Function returning URL for a page.
 * @returns {Array<{text:number|string, href:string|null, selected?:boolean, ellipsis?:boolean}>} Pagination items.
 */
const buildPaginationItems = ({ visiblePages, currentPageIndex, buildPageUrl }) => {
    const items = [];
    let lastPage = 0;

    for (const page of visiblePages) {
        const gap = page - lastPage;

        if (gap === 2) {
            const missingPage = lastPage + 1;
            items.push({
                text: missingPage,
                href: buildPageUrl(missingPage),
                selected: missingPage === currentPageIndex
            });
        } else if (gap > 2) {
            items.push({
                text: '...',
                href: null,
                ellipsis: true
            });
        }

        items.push({
            text: page,
            href: buildPageUrl(page),
            selected: page === currentPageIndex
        });

        lastPage = page;
    }

    return items;
};

/**
 * Builds a query string used by document page pagination links.
 *
 * @param {object} options - Query options.
 * @param {object} [options.query] - Optional request query object.
 * @param {string} [options.query.searchTerm] - Search term to preserve in links.
 * @param {string|number} [options.query.searchResultsPageNumber] - Search results page number to preserve.
 * @param {object} [options.params] - Optional route params object.
 * @param {string} [options.params.crn] - Case reference number.
 * @returns {string} Encoded query string.
 */
const buildQueryString = ({ query, params }) => {
    const { searchTerm = '', searchResultsPageNumber = '' } = query || {};
    const { crn } = params || {};
    const queryParams = new URLSearchParams();

    if (crn) queryParams.append('crn', crn);
    if (searchTerm) queryParams.append('searchTerm', searchTerm);
    if (searchResultsPageNumber) {
        queryParams.append('searchResultsPageNumber', searchResultsPageNumber);
    }

    return queryParams.toString();
};

/**
 * Creates pagination data compatible with the MoJ pagination macro.
 *
 * This is a reusable, route-agnostic builder intended for any page that has
 * current/total page metadata and custom URL requirements.
 *
 * @param {object} options - Pagination options.
 * @param {number|string} options.currentPageIndex - Current page index (1-based).
 * @param {number|string} options.totalPageCount - Total page count.
 * @param {(pageNum: number) => string} options.buildPageUrl - Function that generates a link for a given page.
 * @param {number} [options.windowSize=1] - Number of pages shown either side of current page.
 * @returns {{items:Array,results:{pages:{current:number,count:number},count:number,text:string},previous:{text:string,href:string}|null,next:{text:string,href:string}|null}} Pagination data object.
 */
export const createPaginationData = ({
    currentPageIndex,
    totalPageCount,
    buildPageUrl,
    windowSize = 1
}) => {
    const safeCurrentPage = Number(currentPageIndex || 1);
    const safeTotalPages = Number(totalPageCount || 1);

    const visiblePages = getVisiblePages({
        currentPageIndex: safeCurrentPage,
        totalPageCount: safeTotalPages,
        windowSize
    });

    const items = buildPaginationItems({
        visiblePages,
        currentPageIndex: safeCurrentPage,
        buildPageUrl
    });

    return {
        items,
        results: {
            pages: {
                current: safeCurrentPage,
                count: safeTotalPages
            },
            count: safeTotalPages,
            text: 'results'
        },
        previous:
            safeCurrentPage > 1
                ? {
                      text: 'Previous',
                      href: buildPageUrl(safeCurrentPage - 1)
                  }
                : null,
        next:
            safeCurrentPage < safeTotalPages
                ? {
                      text: 'Next',
                      href: buildPageUrl(safeCurrentPage + 1)
                  }
                : null
    };
};

/**
 * Creates document page pagination data from page metadata.
 *
 * Backward-compatible wrapper around `createPaginationData` for document routes.
 *
 * @param {object} [pageMetadata] - Page metadata object.
 * @param {number|string} [pageMetadata.page_num] - Current page number.
 * @param {number|string} [pageMetadata.page_count] - Total page count.
 * @param {object} [query] - Optional request query object.
 * @param {object} [params] - Optional route params object.
 * @returns {{items:Array,results:{pages:{current:number,count:number},count:number,text:string},previous:{text:string,href:string}|null,next:{text:string,href:string}|null}} Pagination data object.
 */
export const paginationDataFromMetadata = (pageMetadata, query, params) => {
    const queryString = buildQueryString({ query, params });
    const { documentId } = params || {};
    const buildDocumentPageUrl = (pageNum) =>
        `/document/${documentId}/view/page/${pageNum}?${queryString}`;

    return createPaginationData({
        currentPageIndex: pageMetadata?.page_num,
        totalPageCount: pageMetadata?.page_count,
        buildPageUrl: buildDocumentPageUrl
    });
};
