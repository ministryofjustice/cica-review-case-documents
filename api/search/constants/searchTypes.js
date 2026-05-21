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
 * When the input is absent, not a string, or an empty/whitespace-only string,
 * `DEFAULT_SEARCH_TYPE` is returned immediately.
 *
 * When the input is an unrecognised string, the function attempts to resolve a
 * fallback from the session's feature flags (`session.featureFlags.type`).
 * If no feature-flag override is present, `DEFAULT_SEARCH_TYPE` is returned.
 *
 * Comma-delimited values (for example `type=keyword,semantic`) are treated as a
 * single invalid value and follow the fallback path.
 *
 * @param {unknown} searchType - Raw `req.query.type` value.
 * @param {import('express-session').Session} [session] - Request session used to resolve feature-flag fallbacks.
 * @returns {string} A recognised SEARCH_TYPES value.
 *
 * @example
 * resolveSearchType('hybrid-dates')         // 'hybrid-dates'
 * resolveSearchType('semantic')             // 'semantic'
 * resolveSearchType('KEYWORD')             // 'keyword'
 * resolveSearchType('unknown')              // 'hybrid-dates' (DEFAULT_SEARCH_TYPE)
 * resolveSearchType(undefined)              // 'hybrid-dates' (DEFAULT_SEARCH_TYPE)
 * resolveSearchType('unknown', session)     // session.featureFlags.type value, or DEFAULT_SEARCH_TYPE
 */
export function resolveSearchType(searchType, session = {}) {
    if (typeof searchType !== 'string' || !searchType.trim()) {
        return DEFAULT_SEARCH_TYPE;
    }

    const normalisedSearchType = searchType.trim().toLowerCase();

    if (Object.values(SEARCH_TYPES).includes(normalisedSearchType)) {
        return normalisedSearchType;
    }

    // Direct session lookup rather than getFeatureFlagValue() to avoid a circular
    // dependency: featureFlags/index.js imports DEFAULT_SEARCH_TYPE from this module,
    // so importing getFeatureFlagValue back here would create a cycle.
    // Validate the session value before using it — an unrecognised value should not
    // be propagated into URLs or downstream query building.
    const sessionType = session?.featureFlags?.type;
    return Object.values(SEARCH_TYPES).includes(sessionType) ? sessionType : DEFAULT_SEARCH_TYPE;
}
