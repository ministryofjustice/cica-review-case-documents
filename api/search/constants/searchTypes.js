/**
 * Enumeration of supported search modes.
 *
 * | Value             | Description                                                                 |
 * |-------------------|-----------------------------------------------------------------------------|
 * | `keyword`         | Pure BM25 lexical match. Fast, no neural overhead.                          |
 * | `keyword-dates`   | BM25 lexical match with date extraction and variant expansion.              |
 * | `semantic`        | Neural embedding (ANN) search on semantic content only.                     |
 * | `hybrid`          | Combined BM25 + neural with configurable per-clause boost factors.          |
 * | `hybrid-dates`    | Hybrid search with date extraction and variant expansion added to the mix.  |
 *
 * @readonly
 * @enum {string}
 */
const SEARCH_TYPES = Object.freeze({
    /** Pure BM25 lexical match against chunk text. No date extraction. */
    KEYWORD: 'keyword',
    /** BM25 lexical match with date phrase extraction and format-variant expansion. */
    KEYWORD_DATES: 'keyword-dates',
    /** Neural embedding (ANN) search on semantic content. */
    SEMANTIC: 'semantic',
    /** Combined BM25 + neural search with configurable boost factors. No date extraction. */
    HYBRID: 'hybrid',
    /** Combined BM25 + neural search with date phrase extraction and format-variant expansion. */
    HYBRID_DATES: 'hybrid-dates'
});

export default SEARCH_TYPES;
