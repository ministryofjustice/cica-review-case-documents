import { createPublicKey } from 'node:crypto';
import got from 'got';
import jwt from 'jsonwebtoken';
import { getEntraConfig, getEntraIssuer, getEntraJwksUrl, getEntraRedirectUri } from './config.js';

const DEFAULT_ENTRA_JWKS_CACHE_TTL_MS = 60 * 1000;
const entraJwksCacheByTenant = new Map();

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
 * Clears Entra JWKS cache.
 *
 * Test-only helper to isolate module-level cache between test cases.
 */
export function __clearEntraJwksCache() {
    entraJwksCacheByTenant.clear();
}
