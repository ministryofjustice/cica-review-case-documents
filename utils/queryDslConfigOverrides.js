import { DEFAULT_QUERY_DSL_CONFIG } from '../api/DAL/utils/buildQueryJson/queryTypeBuilders.js';

export const QUERY_DSL_CONFIG_INPUT_KEYS = Object.freeze([
    'semanticMinScore',
    'semanticOnlyMinScore',
    'semanticK',
    'lexicalBoost',
    'dateBoost',
    'neuralBoost'
]);

/**
 * Gets the last value when query parsers provide arrays for repeated params.
 *
 * @param {unknown} value - Raw value or array of values.
 * @returns {unknown} Last element for arrays, otherwise the original value.
 */
function getLastValue(value) {
    return Array.isArray(value) ? value.at(-1) : value;
}

/**
 * Converts a raw value to a finite number.
 *
 * @param {unknown} rawValue - Raw value from query/header payload.
 * @returns {number | undefined} Finite number or undefined.
 */
function toFiniteNumber(rawValue) {
    const normalized = getLastValue(rawValue);
    if (typeof normalized === 'number') {
        return Number.isFinite(normalized) ? normalized : undefined;
    }

    if (typeof normalized !== 'string') {
        return undefined;
    }

    const trimmed = normalized.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalizes query DSL override values and drops invalid entries.
 *
 * @param {Record<string, unknown>} rawOverrides - Untrusted override values.
 * @returns {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} Sanitized overrides.
 */
export function normalizeQueryDslConfigOverrides(rawOverrides = {}) {
    const normalized = {};

    const semanticMinScore = toFiniteNumber(rawOverrides.semanticMinScore);
    if (semanticMinScore !== undefined && semanticMinScore >= 0) {
        normalized.semanticMinScore = semanticMinScore;
    }

    const semanticOnlyMinScore = toFiniteNumber(rawOverrides.semanticOnlyMinScore);
    if (semanticOnlyMinScore !== undefined && semanticOnlyMinScore >= 0) {
        normalized.semanticOnlyMinScore = semanticOnlyMinScore;
    }

    const semanticK = toFiniteNumber(rawOverrides.semanticK);
    if (semanticK !== undefined && Number.isInteger(semanticK) && semanticK >= 1) {
        normalized.semanticK = semanticK;
    }

    const lexicalBoost = toFiniteNumber(rawOverrides.lexicalBoost);
    if (lexicalBoost !== undefined && lexicalBoost >= 0) {
        normalized.lexicalBoost = lexicalBoost;
    }

    const dateBoost = toFiniteNumber(rawOverrides.dateBoost);
    if (dateBoost !== undefined && dateBoost >= 0) {
        normalized.dateBoost = dateBoost;
    }

    const neuralBoost = toFiniteNumber(rawOverrides.neuralBoost);
    if (neuralBoost !== undefined && neuralBoost >= 0) {
        normalized.neuralBoost = neuralBoost;
    }

    return normalized;
}

/**
 * Parses query-string parameters into query DSL overrides.
 *
 * @param {Record<string, unknown>} query - Express query object.
 * @returns {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} Sanitized overrides.
 */
export function parseQueryDslConfigFromQuery(query = {}) {
    const rawOverrides = {};
    QUERY_DSL_CONFIG_INPUT_KEYS.forEach((key) => {
        rawOverrides[key] = query[key];
    });

    return normalizeQueryDslConfigOverrides(rawOverrides);
}

/**
 * Serializes sanitized query DSL overrides for reuse in links/forms.
 *
 * @param {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} [overrides={}] - Override values to serialize.
 * @returns {string} URL-encoded query string without a leading `?`.
 */
export function serializeQueryDslConfigOverrides(overrides = {}) {
    const sanitized = normalizeQueryDslConfigOverrides(overrides);
    const params = new URLSearchParams();

    QUERY_DSL_CONFIG_INPUT_KEYS.forEach((key) => {
        if (sanitized[key] !== undefined) {
            params.set(key, String(sanitized[key]));
        }
    });

    return params.toString();
}

/**
 * Parses the serialized query DSL config header.
 *
 * @param {unknown} headerValue - Raw header value.
 * @returns {Partial<typeof DEFAULT_QUERY_DSL_CONFIG> | undefined} Sanitized overrides.
 */
export function parseQueryDslConfigFromHeader(headerValue) {
    if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(headerValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
        }

        const normalized = normalizeQueryDslConfigOverrides(parsed);
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Resolves effective config for display/debugging by merging defaults and overrides.
 *
 * @param {Partial<typeof DEFAULT_QUERY_DSL_CONFIG>} [overrides={}] - Sanitized overrides.
 * @returns {typeof DEFAULT_QUERY_DSL_CONFIG} Effective config values.
 */
export function resolveEffectiveQueryDslConfig(overrides = {}) {
    return {
        ...DEFAULT_QUERY_DSL_CONFIG,
        ...overrides
    };
}
