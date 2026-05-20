/**
 * Enumeration of supported search type values.
 *
 * These are the canonical values accepted in the `type` URL query parameter.
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
 * Resolves a `type` query parameter value to a recognised SEARCH_TYPES value.
 *
 * The input is normalised to lowercase and matched directly against
 * SEARCH_TYPES values, so the URL value and the internal search strategy key stay
 * aligned one to one.
 *
 * Accepts both a plain string or an array (as Express may produce when a query param
 * appears multiple times); when an array is given, the last value is used.
 * Comma-delimited values (for example `type=keyword,semantic`) are treated as a
 * single invalid value.
 *
 * Returns `{ value: undefined, invalidValue: undefined }` when the input is absent or not a
 * string, allowing callers to distinguish "param not present" from "param present but
 * invalid".
 *
 * @param {unknown} input - Raw `req.query.type` value.
 * @returns {{ value: string | undefined, invalidValue: string | undefined }}
 *
 * @example
 * parseSearchType('hybrid-dates') // { value: 'hybrid-dates', invalidValue: undefined }
 * parseSearchType('semantic')     // { value: 'semantic', invalidValue: undefined }
 * parseSearchType('unknown')      // { value: undefined, invalidValue: 'unknown' }
 * parseSearchType(undefined)      // { value: undefined, invalidValue: undefined }
 */
export function parseSearchType(input) {
    const raw = Array.isArray(input) ? input.at(-1) : input;

    if (typeof raw !== 'string' || !raw.trim()) {
        return { value: undefined, invalidValue: undefined };
    }

    const normalized = raw.trim().toLowerCase();
    const value = Object.values(SEARCH_TYPES).includes(normalized) ? normalized : undefined;

    return {
        value,
        invalidValue: value ? undefined : normalized
    };
}

export const parseSearchTypeTokens = parseSearchType;

/**
 * Returns whether the given value is a recognised search type.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} `true` if the value is a recognised SEARCH_TYPES value, otherwise `false`.
 *
 * @example
 * isValidSearchType('hybrid-dates') // true
 * isValidSearchType('keyword')      // true
 * isValidSearchType('unknown')      // false
 * isValidSearchType(undefined)      // false
 */
export function isValidSearchType(value) {
    return Object.values(SEARCH_TYPES).includes(value);
}

/**
 * Resolves a search type value, falling back to DEFAULT_SEARCH_TYPE if the value is
 * absent or not a recognised SEARCH_TYPES value.
 *
 * @param {unknown} value - The value to resolve.
 * @returns {string} The resolved search type value.
 *
 * @example
 * resolveSearchType('hybrid-dates') // 'hybrid-dates'
 * resolveSearchType('keyword')      // 'keyword'
 * resolveSearchType('unknown')      // 'hybrid-dates' (DEFAULT_SEARCH_TYPE)
 * resolveSearchType(undefined)      // 'hybrid-dates' (DEFAULT_SEARCH_TYPE)
 */
export function resolveSearchType(value) {
    return isValidSearchType(value) ? value : DEFAULT_SEARCH_TYPE;
}
