/**
 * @file Builders for non-search OpenSearch query structures used by the DAL.
 */

export const QUERY_MODES = Object.freeze({
    // Canonical default mode handled by search query type builders in buildQueryJson.
    // Kept here so all query mode values are defined in one place.
    SEARCH: 'search',
    PAGE_METADATA: 'page-metadata'
});

export const DEFAULT_QUERY_MODE = QUERY_MODES.SEARCH;

/**
 * Builds the page metadata lookup query.
 *
 * @param {object} params - Query builder params.
 * @param {string} params.documentId - Source document ID.
 * @param {number} params.safePageNumber - Normalized page number.
 * @returns {object} Page metadata query DSL.
 */
export function buildPageMetadataQuery({ documentId, safePageNumber }) {
    return {
        query: {
            bool: {
                must: [
                    { match: { source_doc_id: documentId } },
                    { match: { page_num: safePageNumber } }
                ]
            }
        }
    };
}

/**
 * Creates a map of internal query-mode keys to structure builders.
 *
 * @returns {Record<string, Function>} Map of query modes to builders.
 */
export function createQueryStructureBuilders() {
    return {
        [QUERY_MODES.PAGE_METADATA]: ({ documentId, safePageNumber }) =>
            buildPageMetadataQuery({ documentId, safePageNumber })
    };
}

export const queryStructureBuilders = createQueryStructureBuilders();
