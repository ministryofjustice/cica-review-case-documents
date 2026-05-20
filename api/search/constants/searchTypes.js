/**
 * Enumeration of supported search mode values.
 *
 * These values are the canonical enum values accepted in the `type` URL query parameter.
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
 * Supported URL `type` enum values used to validate incoming query values.
 *
 * @type {ReadonlySet<string>}
 */
export const VALID_SEARCH_TYPE_SET = Object.freeze(new Set(Object.values(SEARCH_TYPES)));

export const VALID_SEARCH_TYPE_VALUES = Object.freeze(Array.from(VALID_SEARCH_TYPE_SET));

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
 * Resolves a `type` query parameter value to a supported SEARCH_TYPES enum value.
 *
 * The input is normalised to lowercase and validated against VALID_SEARCH_TYPE_SET.
 * Valid values pass through unchanged so URL and internal strategy key stay aligned.
 *
 * Accepts both a plain string or an array (as Express may produce when a query param
 * appears multiple times); when an array is given, the last value is used.
 * Comma-delimited values (for example `type=keyword,semantic`) are treated as a
 * single invalid value.
 *
 * Returns `{ searchType: undefined, invalidValue: undefined }` when value is absent or not a
 * string, allowing callers to distinguish "param not present" from "param present but
 * invalid".
 *
 * @param {unknown} value - Raw `req.query.type` value.
 * @returns {{ searchType: string | undefined, invalidValue: string | undefined }}
 *
 * @example
 * parseSearchType('hybrid-dates') // { searchType: 'hybrid-dates', invalidValue: undefined }
 * parseSearchType('semantic')     // { searchType: 'semantic', invalidValue: undefined }
 * parseSearchType('unknown')      // { searchType: undefined, invalidValue: 'unknown' }
 * parseSearchType(undefined)      // { searchType: undefined, invalidValue: undefined }
 */
export function parseSearchType(value) {
    const raw = Array.isArray(value) ? value.at(-1) : value;

    if (typeof raw !== 'string' || !raw.trim()) {
        return { searchType: undefined, invalidValue: undefined };
    }

    const normalized = raw.trim().toLowerCase();
    const resolvedValue = VALID_SEARCH_TYPE_SET.has(normalized) ? normalized : undefined;

    return {
        searchType: resolvedValue,
        invalidValue: resolvedValue ? undefined : normalized
    };
}

export const parseSearchTypeTokens = parseSearchType;
