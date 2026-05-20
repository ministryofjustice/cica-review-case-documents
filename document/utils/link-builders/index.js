/**
 * Utility functions for building navigation and document URLs.
 */

import {
    DEFAULT_SEARCH_TYPE,
    resolveSearchType
} from '../../../api/search/constants/searchTypes.js';

/**
 * Builds the image streaming URL for a document page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchType=DEFAULT_SEARCH_TYPE] - The active search type value
 */
export function buildImageUrl(documentId, pageNumber, crn, searchType = DEFAULT_SEARCH_TYPE) {
    const base = `/document/${documentId}/page/${pageNumber}?crn=${crn}`;
    return `${base}&type=${encodeURIComponent(resolveSearchType(searchType))}`;
}

/**
 * Builds the URL for the text view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string} [searchType=DEFAULT_SEARCH_TYPE] - The active search type value
 * @returns {string} The text view URL
 */
export function buildTextPageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchType = DEFAULT_SEARCH_TYPE
) {
    const base = `/document/${documentId}/view/text/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}`;
    return `${base}&type=${encodeURIComponent(resolveSearchType(searchType))}`;
}

/**
 * Builds the URL for the image view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string} [searchType=DEFAULT_SEARCH_TYPE] - The active search type value
 * @returns {string} The image view URL
 */
export function buildImagePageLink(
    documentId,
    pageNumber,
    crn,
    searchTerm = '',
    searchType = DEFAULT_SEARCH_TYPE
) {
    const base = `/document/${documentId}/view/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}`;
    return `${base}&type=${encodeURIComponent(resolveSearchType(searchType))}`;
}
