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
 * @param {'keyword'|'semantic'|'hybrid'} [searchType='keyword'] - Search type mode
 * @returns {string} The text view URL
 */
export function buildTextPageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchType = 'keyword'
) {
    return `/document/${documentId}/view/text/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&type=${encodeURIComponent(searchType)}`;
}

/**
 * Builds the URL for the image view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {'keyword'|'semantic'|'hybrid'} [searchType='keyword'] - Search type mode
 * @returns {string} The image view URL
 */
export function buildImagePageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchType = 'keyword'
) {
    return `/document/${documentId}/view/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}&type=${encodeURIComponent(searchType)}`;
}
