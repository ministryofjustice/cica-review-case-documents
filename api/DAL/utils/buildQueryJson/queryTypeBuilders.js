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

/**
 * Default tuning values for hybrid/semantic query construction.
 *
 * Tests can override these through buildQueryJson options to avoid coupling
 * behavioural tests to production tuning constants.
 */
export const DEFAULT_QUERY_DSL_CONFIG = Object.freeze({
    /** @type {number} Minimum neural score — needs tuning or replaced with a low K value. */
    semanticMinScore: 0.55,
    /** @type {number} Default number of nearest-neighbour candidates for neural queries. */
    semanticK: 15,
    lexicalBoost: 20,
    dateBoost: 1,
    neuralBoost: 4
});

/**
 * Resolves an effective query DSL configuration by merging user overrides with defaults.
 *
 * @param {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} [overrides={}] - Optional tuning overrides.
 * @returns {typeof DEFAULT_QUERY_DSL_CONFIG} Effective query DSL configuration.
 */
export function resolveQueryDslConfig(overrides = {}) {
    return {
        ...DEFAULT_QUERY_DSL_CONFIG,
        ...overrides
    };
}

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
                filter: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        }
    };
}

/**
 * Creates the neural (vector) query shell scoped to the case reference.
 *
 * The `filter` field is initialised as a single `{ term: { case_ref } }` object, **not**
 * a `bool.filter` array. Callers that need to add further term filters (e.g. document
 * scoping) must first promote it to a `bool.filter` wrapper:
 *
 * ```js
 * queryJson.query.neural.embedding.filter = {
 *     bool: { filter: [queryJson.query.neural.embedding.filter] }
 * };
 * queryJson.query.neural.embedding.filter.bool.filter.push({ term: { ... } });
 * ```
 *
 * @param {object} params - Query shell options.
 * @param {string} params.keyword - Raw search text used as the neural query text.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @returns {object} Neural query DSL shell.
 */
export function createNeuralQuery({
    keyword,
    caseReferenceNumber,
    semanticK = DEFAULT_QUERY_DSL_CONFIG.semanticK,
    semanticMinScore = DEFAULT_QUERY_DSL_CONFIG.semanticMinScore
}) {
    return {
        query: {
            neural: {
                embedding: {
                    query_text: keyword,
                    k: semanticK,
                    filter: { term: { case_ref: caseReferenceNumber } }
                }
            }
        },
        min_score: keyword.trim().length > 0 ? semanticMinScore : undefined
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
export function createHybridQuery({
    caseReferenceNumber,
    semanticMinScore = DEFAULT_QUERY_DSL_CONFIG.semanticMinScore
}) {
    return {
        query: {
            bool: {
                filter: [{ term: { case_ref: caseReferenceNumber } }],
                should: [],
                minimum_should_match: 1
            }
        },
        min_score: semanticMinScore
    };
}

// ---------------------------------------------------------------------------
// Neural filter helper
// ---------------------------------------------------------------------------

/**
 * Builds the neural filter object that pre-scopes the ANN search to the correct case
 * (and optionally document page) so OpenSearch does not retrieve k candidates from
 * other cases before the outer bool.filter filters them out.
 *
 * @param {object} params - Filter parameters.
 * @param {string} params.caseReferenceNumber - Case reference filter value.
 * @param {string} [params.documentId] - Optional document UUID for page-level scoping.
 * @param {number} params.safePageNumber - Normalised page number for document scoping.
 * @returns {object} A single term clause or a bool.filter wrapper.
 */
export function buildNeuralFilter({ caseReferenceNumber, documentId, safePageNumber }) {
    const filters = [{ term: { case_ref: caseReferenceNumber } }];
    if (documentId) {
        filters.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
    }
    return filters.length === 1 ? filters[0] : { bool: { filter: filters } };
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
        queryJson.query.bool.filter.push(
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
export function buildSemanticQuery({
    keyword,
    caseReferenceNumber,
    safePageNumber,
    documentId,
    matchPhraseClauses = [],
    queryDslConfig = DEFAULT_QUERY_DSL_CONFIG
}) {
    const { semanticK, semanticMinScore } = queryDslConfig;

    // When date phrases are present, produce a bool query with the neural clause and
    // date phrase clauses as sibling should branches. A non-empty keyword is implied
    // since dates cannot be extracted from an empty string.
    if (matchPhraseClauses.length > 0) {
        const queryJson = createHybridQuery({ caseReferenceNumber, semanticMinScore });

        if (documentId) {
            queryJson.query.bool.filter.push(
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
                    k: semanticK,
                    filter: neuralFilter
                }
            }
        });

        return queryJson;
    }

    // Pure neural: no date phrases (or empty keyword fallback).
    const queryJson = createNeuralQuery({
        keyword,
        caseReferenceNumber,
        semanticK,
        semanticMinScore
    });

    if (documentId) {
        // Convert filter from single term to bool.filter array for document scoping
        if (!Array.isArray(queryJson.query.neural.embedding.filter)) {
            queryJson.query.neural.embedding.filter = {
                bool: {
                    filter: [queryJson.query.neural.embedding.filter]
                }
            };
        }
        queryJson.query.neural.embedding.filter.bool.filter.push(
            { term: { source_doc_id: documentId } },
            { term: { page_number: safePageNumber } }
        );
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
 * @param {number} params.lexicalBoost - Boost for the lexical match clause.
 * @param {number} params.dateBoost - Boost for the grouped date variant clauses.
 * @param {number} params.neuralBoost - Boost for the neural clause.
 * @returns {object} Assembled hybrid query DSL object.
 */
function buildHybridQuery({
    keyword,
    caseReferenceNumber,
    shouldClauses,
    safePageNumber,
    documentId,
    queryDslConfig = DEFAULT_QUERY_DSL_CONFIG
}) {
    const { semanticK, semanticMinScore, lexicalBoost, dateBoost, neuralBoost } = queryDslConfig;

    const queryJson = createHybridQuery({ caseReferenceNumber, semanticMinScore });

    const matchClause = shouldClauses.find((clause) => Object.hasOwn(clause, 'match'));
    const matchPhraseClauses = shouldClauses.filter((clause) =>
        Object.hasOwn(clause, 'match_phrase')
    );

    if (documentId) {
        queryJson.query.bool.filter.push(
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
                    boost: lexicalBoost
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
                    k: semanticK,
                    filter: neuralFilter,
                    boost: neuralBoost
                }
            }
        });
    }

    return queryJson;
}

/**
 * Creates a map of search-type keys to query-builder functions.
 *
 * Each builder accepts a params object and returns a `{ queryJson, phrases, phrasesVariants, shouldClauses, extractMs, variantMs }` result.
 *
 * @param {object} [params={}] - Options.
 * @param {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} [params.queryDslConfig={}] - Optional tuning overrides merged with defaults.
 * @returns {Record<string, Function>} Map of SEARCH_TYPES values to builder functions.
 */
export function createQueryTypeBuilders({ queryDslConfig = {} } = {}) {
    const resolvedQueryDslConfig = resolveQueryDslConfig(queryDslConfig);

    return {
        [SEARCH_TYPES.KEYWORD]: ({
            keyword,
            caseReferenceNumber,
            safePageNumber,
            documentId,
            logger
        }) => {
            logger?.debug?.(
                { keyword, caseReferenceNumber, safePageNumber, documentId },
                '[QueryTypeBuilder] Building keyword query'
            );
            const { shouldClauses, phrases, phrasesVariants, timings } =
                buildDateAwareShouldClauses({
                    keyword,
                    enableDateExtraction: false
                });
            const queryJson = buildKeywordQuery({
                caseReferenceNumber,
                shouldClauses,
                safePageNumber,
                documentId
            });
            logger?.debug?.({ queryJson }, '[QueryTypeBuilder] keyword query built');

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
            documentId,
            logger
        }) => {
            logger?.debug?.(
                { keyword, caseReferenceNumber, safePageNumber, documentId },
                '[QueryTypeBuilder] Building keyword-dates query'
            );
            const { shouldClauses, phrases, phrasesVariants, timings } =
                buildDateAwareShouldClauses({
                    keyword,
                    enableDateExtraction: true
                });
            const queryJson = buildKeywordQuery({
                caseReferenceNumber,
                shouldClauses,
                safePageNumber,
                documentId
            });
            logger?.debug?.({ queryJson }, '[QueryTypeBuilder] keyword-dates query built');

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
            documentId, // ,
            // enableDateExtraction
            logger
        }) => {
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

            logger?.debug?.(
                { keyword, caseReferenceNumber, safePageNumber, documentId },
                '[QueryTypeBuilder] Building semantic query'
            );
            const queryJson = buildSemanticQuery({
                keyword,
                caseReferenceNumber,
                safePageNumber,
                documentId,
                matchPhraseClauses,
                queryDslConfig: resolvedQueryDslConfig
            });
            logger?.debug?.({ queryJson }, '[QueryTypeBuilder] semantic query built');

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
            logger
        }) => {
            logger?.debug?.(
                {
                    keyword,
                    caseReferenceNumber,
                    safePageNumber,
                    documentId
                },
                '[QueryTypeBuilder] Building hybrid query'
            );
            const { shouldClauses, phrases, phrasesVariants, timings } =
                buildDateAwareShouldClauses({
                    keyword,
                    enableDateExtraction: false
                });
            const queryJson = buildHybridQuery({
                keyword,
                caseReferenceNumber,
                shouldClauses,
                safePageNumber,
                documentId,
                queryDslConfig: resolvedQueryDslConfig
            });
            logger?.debug?.({ queryJson }, '[QueryTypeBuilder] hybrid query built');

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
            logger
        }) => {
            logger?.debug?.(
                {
                    keyword,
                    caseReferenceNumber,
                    safePageNumber,
                    documentId
                },
                '[QueryTypeBuilder] Building hybrid-dates query'
            );
            const { shouldClauses, phrases, phrasesVariants, timings } =
                buildDateAwareShouldClauses({
                    keyword,
                    enableDateExtraction: true
                });
            const queryJson = buildHybridQuery({
                keyword,
                caseReferenceNumber,
                shouldClauses,
                safePageNumber,
                documentId,
                queryDslConfig: resolvedQueryDslConfig
            });
            logger?.debug?.({ queryJson }, '[QueryTypeBuilder] hybrid-dates query built');

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
}

export const queryTypeBuilders = createQueryTypeBuilders();
