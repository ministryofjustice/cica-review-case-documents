import { createPublicKey } from 'node:crypto';
import got from 'got';
import jwt from 'jsonwebtoken';

const DEFAULT_ENTRA_SCOPE = 'openid profile email';
const DEFAULT_ENTRA_JWKS_CACHE_TTL_MS = 60 * 1000;
const TRUE_VALUES = ['1', 'true', 'yes', 'on'];
const entraJwksCacheByTenant = new Map();

/**
 * Returns Entra configuration from environment variables.
 *
 * @returns {{ clientId: string | undefined, clientSecret: string | undefined, tenantId: string | undefined, scope: string }}
 */
export function getEntraConfig() {
    return {
        clientId: process.env.ENTRA_CLIENT_ID,
        // Infra currently maps the client secret value via ENTRA_CLIENT_SECRET_ID.
        // Keep ENTRA_CLIENT_SECRET as a compatible fallback for local/dev and future renaming.
        clientSecret: process.env.ENTRA_CLIENT_SECRET_ID || process.env.ENTRA_CLIENT_SECRET,
        tenantId: process.env.ENTRA_TENANT_ID,
        scope: process.env.ENTRA_SCOPE || DEFAULT_ENTRA_SCOPE
    };
}

/**
 * Builds the expected issuer URL for Entra v2.0 tokens.
 *
 * @param {string} tenantId - Entra tenant identifier.
 * @returns {string}
 */
function getEntraIssuer(tenantId) {
    return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/**
 * Builds the Entra JWKS URL used to resolve token signing keys.
 *
 * @param {string} tenantId - Entra tenant identifier.
 * @returns {string}
 */
function getEntraJwksUrl(tenantId) {
    return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
}

/**
 * Returns JWKS cache TTL in milliseconds.
 *
 * @returns {number}
 */
function getEntraJwksCacheTtlMs() {
    const rawTtl = Number(process.env.ENTRA_JWKS_CACHE_TTL_MS);
    return Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : DEFAULT_ENTRA_JWKS_CACHE_TTL_MS;
}

/**
 * Builds a kid-indexed RSA key map from a JWKS payload.
 *
 * @param {any} jwks - JWKS payload.
 * @returns {Map<string, JsonWebKey>}
 */
function buildKidMapFromJwks(jwks) {
    const kidMap = new Map();

    if (!Array.isArray(jwks?.keys)) {
        return kidMap;
    }

    for (const key of jwks.keys) {
        if (key?.kid && key?.kty === 'RSA') {
            kidMap.set(key.kid, key);
        }
    }

    return kidMap;
}

/**
 * Retrieves a cached signing JWK for a tenant and kid if cache is fresh.
 *
 * @param {string} tenantId - Entra tenant identifier.
 * @param {string} kid - JWT key identifier.
 * @returns {JsonWebKey | undefined}
 */
function getCachedSigningJwk(tenantId, kid) {
    const cached = entraJwksCacheByTenant.get(tenantId);

    if (!cached) {
        return undefined;
    }

    const ttlMs = getEntraJwksCacheTtlMs();
    if (Date.now() - cached.fetchedAtMs > ttlMs) {
        entraJwksCacheByTenant.delete(tenantId);
        return undefined;
    }

    return cached.keysByKid.get(kid);
}

/**
 * Fetches tenant JWKS and refreshes in-memory cache.
 *
 * @param {string} tenantId - Entra tenant identifier.
 * @returns {Promise<Map<string, JsonWebKey>>}
 */
async function fetchAndCacheEntraJwks(tenantId) {
    const jwksUrl = getEntraJwksUrl(tenantId);
    const jwks = await got.get(jwksUrl, { responseType: 'json' }).json();
    const keysByKid = buildKidMapFromJwks(jwks);

    entraJwksCacheByTenant.set(tenantId, {
        fetchedAtMs: Date.now(),
        keysByKid
    });

    return keysByKid;
}

/**
 * Resolves the public key for an Entra id_token from JWKS.
 *
 * @param {string} idToken - Entra id token JWT value.
 * @param {string} tenantId - Entra tenant identifier.
 * @returns {Promise<import('node:crypto').KeyObject>}
 */
async function getEntraSigningKey(idToken, tenantId) {
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || typeof decoded !== 'object' || typeof decoded.header !== 'object') {
        throw new Error('Invalid Entra id_token header');
    }

    const kid = decoded.header.kid;
    if (!kid) {
        throw new Error('Missing Entra id_token kid header');
    }

    let signingJwk = getCachedSigningJwk(tenantId, kid);

    // Refresh on cache miss (including unknown kid) so key rotation is picked up quickly.
    if (!signingJwk) {
        const keysByKid = await fetchAndCacheEntraJwks(tenantId);
        signingJwk = keysByKid.get(kid);
    }

    if (!signingJwk) {
        throw new Error('Unable to find matching Entra signing key');
    }

    return createPublicKey({ key: signingJwk, format: 'jwk' });
}

/**
 * Determines if interactive fallback is enabled after silent SSO fails.
 *
 * Defaults to enabled when ENTRA_INTERACTIVE_FALLBACK is unset.
 *
 * @returns {boolean}
 */
export function isEntraInteractiveFallbackEnabled() {
    const rawValue = process.env.ENTRA_INTERACTIVE_FALLBACK;

    if (rawValue == null) {
        return true;
    }

    return TRUE_VALUES.includes(String(rawValue).toLowerCase());
}

/**
 * Determines whether all required Entra settings are present.
 *
 * @returns {boolean}
 */
export function isEntraConfigured() {
    const { clientId, clientSecret, tenantId } = getEntraConfig();
    return Boolean(clientId && clientSecret && tenantId);
}

/**
 * Builds the callback URI using trusted configuration.
 *
 * In production this requires APP_BASE_URL to avoid relying on request Host headers.
 * In non-production, request protocol/host fallback is allowed for local development.
 *
 * @param {import('express').Request} req - Express request used to resolve protocol and host.
 * @returns {string}
 */
export function getEntraRedirectUri(req) {
    const appBaseUrl = process.env.APP_BASE_URL;

    if (typeof appBaseUrl === 'string' && appBaseUrl.trim().length > 0) {
        return `${appBaseUrl.replace(/\/+$/, '')}/auth/callback`;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('APP_BASE_URL must be set in production for Entra redirect URI');
    }

    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/auth/callback`;
}

/**
 * Builds an Entra authorize URL for the authorization code flow.
 *
 * @param {import('express').Request} req - Express request used to derive callback URI.
 * @param {string} state - OIDC state value bound to the current auth transaction.
 * @param {string} nonce - OIDC nonce value validated against the returned id token.
 * @param {{ prompt?: string, loginHint?: string, domainHint?: string }} [options] - Optional authorize request parameters.
 * @returns {string}
 */
export function buildEntraAuthorizeUrl(req, state, nonce, options = {}) {
    const { clientId, tenantId, scope } = getEntraConfig();
    const redirectUri = getEntraRedirectUri(req);
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope,
        state,
        nonce
    });

    if (options.prompt) {
        params.set('prompt', options.prompt);
    }

    if (options.loginHint) {
        params.set('login_hint', options.loginHint);
    }

    if (options.domainHint) {
        params.set('domain_hint', options.domainHint);
    }

    return `${authUrl}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for tokens at Entra token endpoint.
 *
 * @param {import('express').Request} req - Express request used to derive callback URI.
 * @param {string} code - Authorization code returned by Entra authorize endpoint.
 * @returns {Promise<any>}
 */
export async function exchangeEntraAuthorizationCode(req, code) {
    const { clientId, clientSecret, tenantId, scope } = getEntraConfig();
    const redirectUri = getEntraRedirectUri(req);
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    return got
        .post(tokenUrl, {
            form: {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                scope
            },
            responseType: 'json'
        })
        .json();
}

/**
 * Verifies and validates an Entra ID token.
 *
 * @param {string} idToken - Entra id token JWT value.
 * @param {string} expectedNonce - Nonce generated for the current auth transaction.
 * @returns {Promise<Record<string, any>>}
 */
export async function decodeAndValidateEntraIdToken(idToken, expectedNonce) {
    if (typeof expectedNonce !== 'string' || expectedNonce.trim().length === 0) {
        throw new Error('Missing expected Entra nonce');
    }

    const { clientId, tenantId } = getEntraConfig();
    if (!clientId || !tenantId) {
        throw new Error('Entra configuration missing for id_token validation');
    }

    const issuer = getEntraIssuer(tenantId);
    const signingKey = await getEntraSigningKey(idToken, tenantId);
    const claims = jwt.verify(idToken, signingKey, {
        algorithms: ['RS256'],
        issuer,
        audience: clientId,
        clockTolerance: 5
    });

    if (!claims || typeof claims !== 'object') {
        throw new Error('Invalid Entra id_token payload');
    }

    if (typeof claims.nonce !== 'string' || claims.nonce.trim().length === 0) {
        throw new Error('Missing Entra nonce claim');
    }

    if (claims.nonce !== expectedNonce) {
        throw new Error('Invalid Entra nonce claim');
    }

    return claims;
}

/**
 * Extracts a stable username from Entra claims.
 *
 * @param {Record<string, any>} claims - Decoded id token claims.
 * @returns {string}
 */
export function getUsernameFromEntraClaims(claims) {
    return claims.preferred_username || claims.email || claims.upn || claims.sub || 'entra-user';
}

/**
 * Clears Entra JWKS cache.
 *
 * Test-only helper to isolate module-level cache between test cases.
 */
export function __clearEntraJwksCache() {
    entraJwksCacheByTenant.clear();
}
