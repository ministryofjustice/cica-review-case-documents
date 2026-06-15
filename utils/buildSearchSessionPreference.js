import crypto from 'node:crypto';

/**
 * Builds the deterministic OpenSearch session preference value used for search-related queries.
 *
 * @param {string} searchTerm - Search term used to derive the preference value.
 * @returns {string} Stable OpenSearch preference value for the provided term.
 */
export default function buildSearchSessionPreference(searchTerm) {
    return `session-${crypto.createHash('sha256').update(searchTerm).digest('hex')}`;
}
