/**
 * The primitive capability tokens accepted in the `type` URL query parameter.
 *
 * These are the building blocks that callers combine in a comma-delimited string
 * (e.g. `?type=keyword,semantic,dates`) to select a search mode. Tokens are order-insensitive
 * and any unrecognised values in the string are silently ignored.
 *
 * @readonly
 * @enum {string}
 */
export const SEARCH_TYPE_TOKENS = Object.freeze({
    KEYWORD: 'keyword',
    DATES: 'dates',
    SEMANTIC: 'semantic',
    HYBRID: 'hybrid'
});

const { KEYWORD, DATES, SEMANTIC } = SEARCH_TYPE_TOKENS;
const VALID_TOKEN_VALUES = new Set(Object.values(SEARCH_TYPE_TOKENS));

/**
 * Defines which SEARCH_TYPE_TOKENS must all be present for a given search mode to be selected.
 *
 * Entries are ordered most-specific first so that a multi-token match (e.g. `HYBRID_DATES`)
 * is always found before a subset match (e.g. `HYBRID`) when iterating.
 *
 * This object drives both the SEARCH_TYPES slug derivation and the parseSearchTypeTokens
 * resolution logic — adding a new search mode only requires a new entry here.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const SEARCH_TYPE_RESOLUTIONS = Object.freeze({
    HYBRID_DATES: [KEYWORD, SEMANTIC, DATES],
    KEYWORD_DATES: [KEYWORD, DATES],
    HYBRID: [KEYWORD, SEMANTIC],
    KEYWORD: [KEYWORD],
    SEMANTIC: [SEMANTIC]
});

/**
 * Enumeration of supported search mode slugs.
 *
 * Defined explicitly rather than auto-derived from SEARCH_TYPE_RESOLUTIONS because
 * the resolution token arrays use the primitive capability tokens (`keyword`, `semantic`)
 * while the slugs use the semantic shorthand (`hybrid`). Keeping them separate avoids
 * a join producing `keyword-semantic-dates` instead of `hybrid-dates`.
 *
 * | Key             | Resolving tokens                    | Slug             |
 * |-----------------|-------------------------------------|------------------|
 * | `HYBRID_DATES`  | `keyword` + `semantic` + `dates`    | `hybrid-dates`   |
 * | `KEYWORD_DATES` | `keyword` + `dates`                 | `keyword-dates`  |
 * | `HYBRID`        | `keyword` + `semantic`              | `hybrid`         |
 * | `KEYWORD`       | `keyword`                           | `keyword`        |
 * | `SEMANTIC`      | `semantic`                          | `semantic`       |
 *
 * @readonly
 * @enum {string}
 */
const SEARCH_TYPES = Object.freeze({
    HYBRID_DATES: 'hybrid-dates',
    KEYWORD_DATES: 'keyword-dates',
    HYBRID: 'hybrid',
    KEYWORD: 'keyword',
    SEMANTIC: 'semantic'
});

export default SEARCH_TYPES;

/**
 * The default search mode used when no `type` query parameter is provided.
 *
 * Centralised here so that every consumer (middleware, tests, docs) derives
 * the value from the single source of truth in SEARCH_TYPES rather than
 * repeating a magic string.
 *
 * @type {string}
 */
export const DEFAULT_SEARCH_TYPE = SEARCH_TYPES.HYBRID_DATES;

/**
 * Resolves a comma-delimited `type` query parameter value to a SEARCH_TYPES slug.
 *
 * The input is split on commas and each part is checked against SEARCH_TYPE_TOKENS.
 * Parts that are not recognised tokens are collected into `unknownTokens` — callers
 * should treat a non-empty `unknownTokens` array as an invalid request (e.g. 400).
 * The remaining valid tokens are matched against SEARCH_TYPE_RESOLUTIONS (most-specific
 * first) and the slug for the first full match is returned as `slug`.
 *
 * Accepts both a plain string or an array (as Express may produce when a query param
 * appears multiple times); when an array is given, the last value is used.
 *
 * Returns `{ slug: undefined, unknownTokens: [] }` when value is absent or not a string,
 * allowing callers to distinguish "param not present" from "param present but invalid".
 *
 * @param {unknown} value - Raw `req.query.type` value.
 * @returns {{ slug: string | undefined, unknownTokens: string[] }}
 *
 * @example
 * parseSearchTypeTokens('hybrid,dates')          // { slug: 'hybrid-dates', unknownTokens: [] }
 * parseSearchTypeTokens('keyword,hybrid')        // { slug: 'hybrid', unknownTokens: [] }
 * parseSearchTypeTokens('keyword,unknown,dates') // { slug: 'keyword-dates', unknownTokens: ['unknown'] }
 * parseSearchTypeTokens('unknown')               // { slug: undefined, unknownTokens: ['unknown'] }
 * parseSearchTypeTokens('dates')                 // { slug: undefined, unknownTokens: [] }
 * parseSearchTypeTokens(undefined)               // { slug: undefined, unknownTokens: [] }
 */
export function parseSearchTypeTokens(value) {
    // last occurrence of the query param wins. Accept both string and array input for
    // flexibility in handling raw query values.
    const raw = Array.isArray(value) ? value.at(-1) : value;

    if (typeof raw !== 'string' || !raw.trim()) {
        return { slug: undefined, unknownTokens: [] };
    }

    const parts = raw
        .toLowerCase()
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    const unknownTokens = parts.filter((part) => !VALID_TOKEN_VALUES.has(part));
    const tokens = new Set(parts.filter((part) => VALID_TOKEN_VALUES.has(part)));

    if (tokens.size === 0) {
        return { slug: undefined, unknownTokens };
    }

    // find the resolution whose token set exactly matches the valid input tokens.
    for (const [searchType, searchTypeComponents] of Object.entries(SEARCH_TYPE_RESOLUTIONS)) {
        if (
            searchTypeComponents.length === tokens.size &&
            searchTypeComponents.every((token) => tokens.has(token))
        ) {
            return { slug: SEARCH_TYPES[searchType], unknownTokens };
        }
    }

    return { slug: undefined, unknownTokens };
}
