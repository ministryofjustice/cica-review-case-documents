import got from 'got';
import jwt from 'jsonwebtoken';

const DEFAULT_ENTRA_SCOPE = 'openid profile email';
const TRUE_VALUES = ['1', 'true', 'yes', 'on'];

/**
 * Returns Entra configuration from environment variables.
 *
 * @returns {{ clientId: string | undefined, clientSecret: string | undefined, tenantId: string | undefined, scope: string }}
 */
export function getEntraConfig() {
    return {
        clientId: process.env.ENTRA_CLIENT_ID,
        clientSecret: process.env.ENTRA_CLIENT_SECRET_ID || process.env.ENTRA_CLIENT_SECRET,
        tenantId: process.env.ENTRA_TENANT_ID,
        scope: process.env.ENTRA_SCOPE || DEFAULT_ENTRA_SCOPE
    };
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
 * Builds the callback URI using the incoming request context.
 *
 * @param {import('express').Request} req - Express request used to resolve protocol and host.
 * @returns {string}
 */
export function getEntraRedirectUri(req) {
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
 * Decodes and validates the nonce claim from an Entra ID token.
 *
 * @param {string} idToken - Entra id token JWT value.
 * @param {string} expectedNonce - Nonce generated for the current auth transaction.
 * @returns {Record<string, any>}
 */
export function decodeAndValidateEntraIdToken(idToken, expectedNonce) {
    const claims = jwt.decode(idToken);

    if (!claims || typeof claims !== 'object') {
        throw new Error('Invalid Entra id_token payload');
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
