import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';

/**
 * Builds an OpenSearch  query JSON object based on the provided search parameters.
 *
 * The query:
 * - Filters by an exact `case_ref` using a `term` query.
 * - Extracts date phrases from the keyword and adds them as `match_phrase` queries.
 * - Adds remaining keyword text as a `match` query against `chunk_text`.
 * - Applies pagination using `from` and `size`.
 *
 * @param {Object} params - Search parameters.
 * @param {string} params.keyword - Raw search string entered by the user. May contain date phrases and free text.
 * @param {string} params.caseReferenceNumber - Exact case reference number to filter results by.
 * @param {number} params.pageNumber - The current page number (1-based).
 * @param {number} params.itemsPerPage - Number of results to return per page.
 *
 * @returns {Object} OpenSearch query DSL JSON object.
 */
function buildQueryJson({ keyword, caseReferenceNumber, pageNumber, itemsPerPage }) {
    const queryJson = {
        from: itemsPerPage * (pageNumber - 1),
        size: itemsPerPage,
        query: {
            bool: {
                // `term` is used for exact matching of the case reference
                // number, otherwise it will be tokenised.
                must: [{ term: { case_ref: caseReferenceNumber } }]
            }
        }
    };

    const {
        dates: phrases,
        remainingText,
        matchedPatterns
    } = extractDatesFromSearchString(keyword);

    const shouldClauses = [];

    // build variants for each extracted phrase, falling back to the
    // original phrase if no variants are produced, and then
    // deduplicate (via the new Set) across all phrases.
    const phrasesVariants = Array.from(
        new Set(
            phrases.flatMap((phrase, index) => {
                const variants = generateDateFormatVariants(phrase, matchedPatterns[index]);
                if (!variants || variants.length === 0) {
                    return [phrase];
                }
                return variants;
            })
        )
    );

    // add match_phrase queries for each extracted date phrase.
    if (phrasesVariants.length !== 0) {
        phrasesVariants.forEach((phrase) => {
            shouldClauses.push({
                match_phrase: {
                    chunk_text: phrase
                }
            });
        });
    }

    // add match query for remaining text.
    if (remainingText) {
        shouldClauses.push({
            match: {
                chunk_text: {
                    query: remainingText,
                    operator: 'or'
                }
            }
        });
    }

    if (shouldClauses.length > 0) {
        queryJson.query.bool.should = shouldClauses;
        queryJson.query.bool.minimum_should_match = 1;
    }
    return queryJson;
}

export default buildQueryJson;
