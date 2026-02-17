/**
 * Utility functions for building navigation and document URLs.
 */

/**
 * Builds the image streaming URL for a document page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @returns {string} The image URL path
 */
export function buildImageUrl(documentId, pageNumber, crn) {
    return `/document/${documentId}/page/${pageNumber}?crn=${crn}`;
}

/**
 * Builds the URL for the text view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string|number} [searchResultsPageNumber=''] - The search results page number
 * @returns {string} The text view URL
 */
export function buildTextPageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchResultsPageNumber = ''
) {
    return `/document/${documentId}/view/text/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&searchResultsPageNumber=${searchResultsPageNumber}`;
}

/**
 * Builds the URL for the image view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string|number} [searchResultsPageNumber=''] - The search results page number
 * @returns {string} The image view URL
 */
export function buildImagePageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchResultsPageNumber = ''
) {
    return `/document/${documentId}/view/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&searchResultsPageNumber=${searchResultsPageNumber}`;
}

/**
 * Builds the back link based on search context.
 * Returns search results page if a search term exists, otherwise returns search home.
 *
 * @param {string} [searchTerm=''] - The search term
 * @param {string|number} [searchResultsPageNumber=''] - The search results page number
 * @param {string} [crn=''] - The case reference number
 * @returns {string} The back link URL
 */
export function buildBackLink(searchTerm = '', searchResultsPageNumber = '', crn = '') {
    if (searchTerm === '') {
        return '/search';
    }
    return `/search?query=${encodeURIComponent(searchTerm)}&pageNumber=${searchResultsPageNumber}&crn=${encodeURIComponent(crn)}`;
}
