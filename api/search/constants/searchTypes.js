/**
 * Enumeration of supported search mode slugs.
 *
 * These slugs are the canonical values accepted in the `type` URL query parameter.
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
 * Direct lookup of supported URL search types.
 *
 * The query-string `type` value is validated against this object and then passed
 * through unchanged to downstream search strategy selection.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SEARCH_TYPE_RESOLUTIONS = Object.freeze({
    [SEARCH_TYPES.HYBRID_DATES]: SEARCH_TYPES.HYBRID_DATES,
    [SEARCH_TYPES.KEYWORD_DATES]: SEARCH_TYPES.KEYWORD_DATES,
    [SEARCH_TYPES.HYBRID]: SEARCH_TYPES.HYBRID,
    [SEARCH_TYPES.KEYWORD]: SEARCH_TYPES.KEYWORD,
    [SEARCH_TYPES.SEMANTIC]: SEARCH_TYPES.SEMANTIC
});

export const VALID_SEARCH_TYPE_VALUES = Object.freeze(Object.keys(SEARCH_TYPE_RESOLUTIONS));

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
 * Resolves a `type` query parameter value to a supported SEARCH_TYPES slug.
 *
 * The input is normalised to lowercase and matched directly against
 * SEARCH_TYPE_RESOLUTIONS, so the URL value and the internal search strategy key stay
 * aligned one to one.
 *
 * Accepts both a plain string or an array (as Express may produce when a query param
 * appears multiple times); when an array is given, the last value is used.
 *
 * Returns `{ slug: undefined, invalidValue: undefined }` when value is absent or not a
 * string, allowing callers to distinguish "param not present" from "param present but
 * invalid".
 *
 * @param {unknown} value - Raw `req.query.type` value.
 * @returns {{ slug: string | undefined, invalidValue: string | undefined }}
 *
 * @example
 * parseSearchType('hybrid-dates') // { slug: 'hybrid-dates', invalidValue: undefined }
 * parseSearchType('semantic')     // { slug: 'semantic', invalidValue: undefined }
 * parseSearchType('unknown')      // { slug: undefined, invalidValue: 'unknown' }
 * parseSearchType(undefined)      // { slug: undefined, invalidValue: undefined }
 */
export function parseSearchType(value) {
    const raw = Array.isArray(value) ? value.at(-1) : value;

    if (typeof raw !== 'string' || !raw.trim()) {
        return { slug: undefined, invalidValue: undefined };
    }

    const normalized = raw.trim().toLowerCase();
    const slug = SEARCH_TYPE_RESOLUTIONS[normalized];

    return {
        slug,
        invalidValue: slug ? undefined : normalized
    };
}

export const parseSearchTypeTokens = parseSearchType;
