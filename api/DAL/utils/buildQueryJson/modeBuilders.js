/**
 * Mode-specific query builders for different search strategies.
 * Each builder constructs an OpenSearch DSL query for its search mode.
 */

import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';
import { SEARCH_TYPES } from './types.js';
import './types.js';

const SEMANTIC_MIN_SCORE = 0.1;
const DEFAULT_SEMANTIC_K = 5;
const DEFAULT_LEXICAL_BOOST = 12;
const DEFAULT_DATE_BOOST = 1;
const DEFAULT_NEURAL_BOOST = 4;

/**
 * Builds lexical should clauses and date-processing metrics.
 * Only called by keyword and hybrid mode builders.
 *
 * @param {object} params - Date processing options.
 * @param {string} params.keyword - Raw search string.
 * @param {boolean} [params.enableDateExtraction=true] - Whether to extract and expand dates.
 * @returns {DateAwareShouldClausesResult} Lexical clauses and date-processing metrics.
 */
function buildDateAwareShouldClauses({ keyword, enableDateExtraction = true }) {
    const extractStart = Date.now();

    let phrases = [];
    let remainingText = keyword;
    let matchedPatterns = [];

    if (enableDateExtraction) {
        const extractionResult = extractDatesFromSearchString(keyword);
        phrases = extractionResult.dates;
        remainingText = extractionResult.remainingText;
        matchedPatterns = extractionResult.matchedPatterns;
    }

    const extractEnd = Date.now();

    const variantStart = Date.now();
    let phrasesVariants = [];

    if (enableDateExtraction) {
        phrasesVariants = Array.from(
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
    }

    const variantEnd = Date.now();

    const shouldClauses = [];

    if (phrasesVariants.length > 0) {
        phrasesVariants.forEach((phrase) => {
            shouldClauses.push({
                match_phrase: {
                    chunk_text: phrase
                }
            });
        });
    }

    if (remainingText) {
        shouldClauses.push({
            match: {
                chunk_text: {
                    query: remainingText
                }
            }
        });
    }

    return {
        shouldClauses,
        phrases,
        phrasesVariants,
        timings: {
            extractMs: extractEnd - extractStart,
            variantMs: variantEnd - variantStart
        }
    };
}

/**
 * Creates the lexical query shell scoped to the case reference.
 *
 * @param {string} caseReferenceNumber - Case reference filter value.
 * @returns {object} Lexical query DSL object.
 */
function createLexicalQuery({ caseReferenceNumber }) {
    return {
        query: {
            bool: {
                must: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        }
    };
}

/**
 * Creates the semantic neural query (scoped to the case reference).
 *
 * @param {object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Semantic query DSL object.
 */
function createNeuralQuery({ keyword, caseReferenceNumber }) {
    return {
        query: {
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    filter: {
                        bool: {
                            must: [{ term: { case_ref: caseReferenceNumber } }]
                        }
                    }
                }
            }
        },
        min_score: keyword.trim().length > 0 ? SEMANTIC_MIN_SCORE : undefined
    };
}

/**
 * Creates the hybrid query shell scoped to the case reference.
 *
 * @param {string} caseReferenceNumber - Case reference filter value.
 * @returns {object} Hybrid query DSL object.
 */
function createHybridQuery({ caseReferenceNumber }) {
    return {
        query: {
            bool: {
                must: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        },
        min_score: SEMANTIC_MIN_SCORE
    };
}

/**
 * Assembles the keyword (lexical) query, applying should clauses and optional document scoping.
 *
 * @param {object} params - Keyword query options.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {Array<object>} params.shouldClauses - Lexical should clauses from date/text extraction.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @returns {object} Assembled keyword query DSL object.
 */
function buildKeywordQuery({ caseReferenceNumber, shouldClauses, safePageNumber, documentId }) {
    const queryJson = createLexicalQuery({ caseReferenceNumber });

    queryJson.query.bool.should = shouldClauses;
    queryJson.query.bool.minimum_should_match = shouldClauses.length > 0 ? 1 : undefined;

    if (documentId) {
        queryJson.query.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    return queryJson;
}

/**
 * Assembles the semantic (neural) query, applying optional document scoping and simplifying
 * the filter DSL where possible.
 *
 * @param {object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @returns {object} Assembled semantic query DSL object.
 */
function buildSemanticQuery({ keyword, caseReferenceNumber, safePageNumber, documentId }) {
    const queryJson = createNeuralQuery({ keyword, caseReferenceNumber });

    if (documentId) {
        queryJson.query.neural.embedding.filter.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    // When there is only a single filter must clause and the keyword is non-empty,
    // simplify the DSL by unwrapping the bool wrapper.
    if (
        queryJson.query.neural.embedding.filter.bool.must.length === 1 &&
        keyword.trim().length !== 0
    ) {
        queryJson.query.neural.embedding.filter =
            queryJson.query.neural.embedding.filter.bool.must[0];
    }

    // An empty keyword means the neural clause has no query text and would match
    // everything. Promote the filter to the top-level query and drop the neural
    // clause and min_score so the query correctly scopes to case_ref only.
    if (keyword.trim().length === 0) {
        queryJson.query = queryJson.query.neural.embedding.filter;
        delete queryJson.query.neural;
        delete queryJson.min_score;
    }

    return queryJson;
}

/**
 * Assembles the hybrid (bool + neural) query, combining boosted lexical, date, and neural
 * should clauses with optional document scoping.
 *
 * @param {object} params - Hybrid query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {Array<object>} params.shouldClauses - Lexical should clauses from date/text extraction.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @param {number} params.keywordBoost - Boost for the lexical match clause.
 * @param {number} params.dateBoost - Boost for the grouped date variant clauses.
 * @param {number} params.semanticBoost - Boost for the neural clause.
 * @returns {object} Assembled hybrid query DSL object.
 */
function buildHybridQuery({
    keyword,
    caseReferenceNumber,
    shouldClauses,
    safePageNumber,
    documentId,
    keywordBoost,
    dateBoost,
    semanticBoost
}) {
    const queryJson = createHybridQuery({ caseReferenceNumber });

    const matchClause = shouldClauses.find((clause) => Object.hasOwn(clause, 'match'));
    const matchPhraseClauses = shouldClauses.filter((clause) =>
        Object.hasOwn(clause, 'match_phrase')
    );

    if (documentId) {
        queryJson.query.bool.must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }

    // Boosted lexical match clause.
    if (matchClause?.match?.chunk_text) {
        queryJson.query.bool.should.push({
            match: {
                chunk_text: {
                    ...matchClause.match.chunk_text,
                    boost: keywordBoost
                }
            }
        });
    }

    // Boosted date variant clauses, grouped so they share a single boost weight.
    if (matchPhraseClauses.length > 0) {
        queryJson.query.bool.should.push({
            bool: {
                should: matchPhraseClauses,
                minimum_should_match: 1,
                boost: dateBoost
            }
        });
    }

    // Boosted neural clause — only when the keyword is non-empty.
    if (keyword.trim().length > 0) {
        queryJson.query.bool.should.push({
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    boost: semanticBoost
                }
            }
        });
    }

    return queryJson;
}

/**
 * Maps search modes to their corresponding query builder functions.
 * Each builder returns both the query DSL and metrics for logging.
 *
 * @type {object}
 */
export const queryModeBuilders = {
    [SEARCH_TYPES.KEYWORD]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        enableDateExtraction
    }) => {
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction
        });
        const queryJson = buildKeywordQuery({
            caseReferenceNumber,
            shouldClauses,
            safePageNumber,
            documentId
        });
        return {
            queryJson,
            phrases,
            phrasesVariants,
            shouldClauses,
            extractMs: timings.extractMs,
            variantMs: timings.variantMs
        };
    },

    [SEARCH_TYPES.SEMANTIC]: ({ keyword, caseReferenceNumber, safePageNumber, documentId }) => {
        // Semantic mode skips date preprocessing entirely (no wasted extraction).
        const queryJson = buildSemanticQuery({
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId
        });
        return {
            queryJson,
            phrases: [],
            phrasesVariants: [],
            shouldClauses: [],
            extractMs: 0,
            variantMs: 0
        };
    },

    [SEARCH_TYPES.HYBRID]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        enableDateExtraction,
        keywordBoost,
        dateBoost,
        semanticBoost
    }) => {
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction
        });
        const queryJson = buildHybridQuery({
            keyword,
            caseReferenceNumber,
            shouldClauses,
            safePageNumber,
            documentId,
            keywordBoost,
            dateBoost,
            semanticBoost
        });
        return {
            queryJson,
            phrases,
            phrasesVariants,
            shouldClauses,
            extractMs: timings.extractMs,
            variantMs: timings.variantMs
        };
    }
};

export { DEFAULT_DATE_BOOST, DEFAULT_LEXICAL_BOOST, DEFAULT_NEURAL_BOOST };
