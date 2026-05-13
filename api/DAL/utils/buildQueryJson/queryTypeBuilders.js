/**
 * @file OpenSearch DSL query shell factories and mode-specific query assemblers.
 *
 * The shell factories (`create*Query`) produce bare query envelopes scoped to a case
 * reference. The assemblers (`build*Query`) fill in the should/must clauses, apply
 * document scoping, and return a complete query DSL object ready for execution.
 *
 * Adding a new query type:
 * 1. Export a new `create*Query` shell factory from this module.
 * 2. Export a new `build*Query` assembler that uses it.
 * 3. Import and wire it up in `index.js`.
 */

import SEARCH_TYPES from '../../../search/constants/searchTypes.js';
import extractDatesFromSearchString from '../extractDatesFromSearchString/index.js';
import generateDateFormatVariants from '../generateDateFormatVariants/index.js';

/** @type {number} Minimum neural score — needs tuning or replaced with a low K value. */
const SEMANTIC_MIN_SCORE = 0.1;

/** @type {number} Default number of nearest-neighbour candidates for neural queries. */
const DEFAULT_SEMANTIC_K = 5;

const DEFAULT_LEXICAL_BOOST = 12;
const DEFAULT_DATE_BOOST = 1;
const DEFAULT_NEURAL_BOOST = 4;

// ---------------------------------------------------------------------------
// Low-level DSL shell factories
// ---------------------------------------------------------------------------

/**
 * Creates the lexical (BM25) query shell scoped to the case reference.
 * The caller is expected to populate `query.bool.should` with match/match_phrase clauses.
 *
 * @param {object} params - Query shell options.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Lexical query DSL shell.
 */
export function createLexicalQuery({ caseReferenceNumber }) {
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
 * Creates the neural (vector) query shell scoped to the case reference.
 * The caller may extend `query.neural.embedding.filter.bool.must` with additional term filters.
 *
 * @param {object} params - Query shell options.
 * @param {string} params.keyword - Raw search text used as the neural query text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Neural query DSL shell.
 */
export function createNeuralQuery({ keyword, caseReferenceNumber }) {
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
 * Used when both lexical and neural branches are combined in a single bool query.
 * The caller populates `query.bool.should` with boosted lexical, date, and neural clauses.
 *
 * @param {object} params - Query shell options.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Hybrid query DSL shell.
 */
export function createHybridQuery({ caseReferenceNumber }) {
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

// ---------------------------------------------------------------------------
// Neural filter helper
// ---------------------------------------------------------------------------

/**
 * Builds the neural filter object that pre-scopes the ANN search to the correct case
 * (and optionally document page) so OpenSearch does not retrieve k candidates from
 * other cases before the outer bool.must filters them out.
 *
 * @param {object} params - Filter parameters.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {string} [params.documentId] - Optional document UUID for page-level scoping.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @returns {object} A single term clause or a bool.must wrapper.
 */
export function buildNeuralFilter({ caseReferenceNumber, documentId, safePageNumber }) {
    const must = [{ term: { case_ref: caseReferenceNumber } }];
    if (documentId) {
        must.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }
    return must.length === 1 ? must[0] : { bool: { must } };
}

// ---------------------------------------------------------------------------
// Shared preprocessing
// ---------------------------------------------------------------------------

/**
 * Builds lexical should clauses and date-processing metrics.
 *
 * @param {object} params - Date processing options.
 * @param {string} params.keyword - Raw search string.
 * @param {boolean} [params.enableDateExtraction=true] - Whether to extract and expand dates.
 * @returns {{ shouldClauses: Array<object>, phrases: Array<string>, phrasesVariants: Array<string>, timings: { extractMs: number, variantMs: number } }} Lexical clauses and date-processing metrics.
 */
export function buildDateAwareShouldClauses({ keyword, enableDateExtraction = true }) {
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
        // Build variants for each extracted phrase, falling back to the
        // original phrase if no variants are produced, and then
        // deduplicate (via the Set) across all phrases.
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

// ---------------------------------------------------------------------------
// Mode-specific query assemblers
// ---------------------------------------------------------------------------

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
 * Assembles the semantic (neural) query, applying optional document scoping.
 * When date match_phrase clauses are supplied, wraps the neural clause in a bool
 * query alongside the date should clauses (semantic + dates mode).
 *
 * @param {object} params - Semantic query options.
 * @param {string} params.keyword - Raw search text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @param {string} [params.documentId] - Optional document UUID to scope results to a single page.
 * @param {Array<object>} [params.matchPhraseClauses=[]] - Date match_phrase clauses to include alongside the neural clause.
 * @returns {object} Assembled semantic (or semantic + dates) query DSL object.
 */
function buildSemanticQuery({
    keyword,
    caseReferenceNumber,
    safePageNumber,
    documentId,
    matchPhraseClauses = []
}) {
    // When date phrases are present, produce a bool query with the neural clause and
    // date phrase clauses as sibling should branches. A non-empty keyword is implied
    // since dates cannot be extracted from an empty string.
    if (matchPhraseClauses.length > 0) {
        const queryJson = createHybridQuery({ caseReferenceNumber });

        if (documentId) {
            queryJson.query.bool.must.push(
                { term: { source_doc_id: documentId } },
                { term: { page_number: safePageNumber } }
            );
        }

        queryJson.query.bool.should.push({
            bool: {
                should: matchPhraseClauses,
                minimum_should_match: 1
            }
        });

        const neuralFilter = buildNeuralFilter({ caseReferenceNumber, documentId, safePageNumber });
        queryJson.query.bool.should.push({
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    filter: neuralFilter
                }
            }
        });

        return queryJson;
    }

    // Pure neural: no date phrases (or empty keyword fallback).
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
 * Assembles the hybrid query, combining boosted lexical, date, and neural should clauses
 * with optional document scoping. Always includes both keyword (BM25) and semantic
 * (neural) branches — date phrase clauses are added when present.
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
        const neuralFilter = buildNeuralFilter({ caseReferenceNumber, documentId, safePageNumber });
        queryJson.query.bool.should.push({
            neural: {
                embedding: {
                    query_text: keyword,
                    k: DEFAULT_SEMANTIC_K,
                    filter: neuralFilter,
                    boost: semanticBoost
                }
            }
        });
    }

    return queryJson;
}

export const queryTypeBuilders = {
    [SEARCH_TYPES.KEYWORD]: ({ keyword, caseReferenceNumber, safePageNumber, documentId }) => {
        console.log('Building keyword query with input:', {
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId
        }); // TEMP logging for verification during development.
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction: false
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
    [SEARCH_TYPES.KEYWORD_DATES]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId
    }) => {
        console.log('Building keyword-dates query with input:', {
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId
        }); // TEMP logging for verification during development.
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction: true
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

    [SEARCH_TYPES.SEMANTIC]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId // ,
        // enableDateExtraction
    }) => {
        console.log('Building semantic query with input:', {
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId
        }); // TEMP logging for verification during development.
        const phrases = [];
        const phrasesVariants = [];
        const matchPhraseClauses = [];
        const extractMs = 0;
        const variantMs = 0;

        // if (enableDateExtraction) {
        //     const {
        //         shouldClauses,
        //         phrases: p,
        //         phrasesVariants: pv,
        //         timings
        //     } = buildDateAwareShouldClauses({ keyword, enableDateExtraction });
        //     phrases = p;
        //     phrasesVariants = pv;
        //     matchPhraseClauses = shouldClauses.filter((c) => Object.hasOwn(c, 'match_phrase'));
        //     extractMs = timings.extractMs;
        //     variantMs = timings.variantMs;
        // }

        const queryJson = buildSemanticQuery({
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId,
            matchPhraseClauses
        });
        return {
            queryJson,
            phrases,
            phrasesVariants,
            shouldClauses: matchPhraseClauses,
            extractMs,
            variantMs
        };
    },

    [SEARCH_TYPES.HYBRID]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        boostConfig: {
            keywordBoost = DEFAULT_LEXICAL_BOOST,
            dateBoost = DEFAULT_DATE_BOOST,
            semanticBoost = DEFAULT_NEURAL_BOOST
        } = {}
    }) => {
        console.log('Building hybrid query with input:', {
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId,
            boostConfig: { keywordBoost, dateBoost, semanticBoost }
        }); // TEMP logging for verification during development.
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction: false
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
    },

    [SEARCH_TYPES.HYBRID_DATES]: ({
        keyword,
        caseReferenceNumber,
        safePageNumber,
        documentId,
        boostConfig: {
            keywordBoost = DEFAULT_LEXICAL_BOOST,
            dateBoost = DEFAULT_DATE_BOOST,
            semanticBoost = DEFAULT_NEURAL_BOOST
        } = {}
    }) => {
        console.log('Building hybrid-dates query with input:', {
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId,
            boostConfig: { keywordBoost, dateBoost, semanticBoost }
        }); // TEMP logging for verification during development.
        const { shouldClauses, phrases, phrasesVariants, timings } = buildDateAwareShouldClauses({
            keyword,
            enableDateExtraction: true
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
