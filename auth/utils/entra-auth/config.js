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
        clientSecret: process.env.ENTRA_CLIENT_SECRET,
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
export function getEntraIssuer(tenantId) {
    return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/**
 * Builds the Entra JWKS URL used to resolve token signing keys.
 *
 * @param {string} tenantId - Entra tenant identifier.
 * @returns {string}
 */
export function getEntraJwksUrl(tenantId) {
    return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
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
 * APP_BASE_URL is required to avoid relying on request Host headers.
 *
 * @param {import('express').Request} req - Express request used to resolve protocol and host.
 * @returns {string}
 */
export function getEntraRedirectUri(req) {
    const appBaseUrl = process.env.APP_BASE_URL;

    if (typeof appBaseUrl === 'string' && appBaseUrl.trim().length > 0) {
        return `${appBaseUrl.replace(/\/+$/, '')}/auth/callback`;
    }

    throw new Error('APP_BASE_URL must be set for Entra redirect URI');
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
