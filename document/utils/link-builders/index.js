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
 * @param {string} [searchType=''] - Optional active search type feature flag value; when omitted, no `type` query parameter is added
 * @returns {string} The image URL path
 */
export function buildImageUrl(documentId, pageNumber, crn, searchType = '') {
    const base = `/document/${documentId}/page/${pageNumber}?crn=${crn}`;
    return searchType ? `${base}&type=${encodeURIComponent(searchType)}` : base;
}

/**
 * Builds the URL for the text view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string} [searchType=''] - Optional active search type feature flag value; when omitted, no `type` query parameter is added
 * @returns {string} The text view URL
 */
export function buildTextPageLink(documentId, pageNumber, crn, searchTerm = '', searchType = '') {
    const base = `/document/${documentId}/view/text/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}`;
    return searchType ? `${base}&type=${encodeURIComponent(searchType)}` : base;
}

/**
 * Builds the URL for the image view page.
 *
 * @param {string} documentId - The document UUID
 * @param {number} pageNumber - The page number
 * @param {string} crn - The case reference number
 * @param {string} [searchTerm=''] - The search term
 * @param {string} [searchType=''] - Optional active search type feature flag value; when omitted, no `type` query parameter is added
 * @returns {string} The image view URL
 */
export function buildImagePageLink(documentId, pageNumber, crn, searchTerm = '', searchType = '') {
    const base = `/document/${documentId}/view/page/${pageNumber}?crn=${encodeURIComponent(crn)}&searchTerm=${encodeURIComponent(searchTerm)}`;
    return searchType ? `${base}&type=${encodeURIComponent(searchType)}` : base;
}
