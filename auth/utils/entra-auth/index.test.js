import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import got from 'got';
import {
    buildEntraAuthorizeUrl,
    decodeAndValidateEntraIdToken,
    exchangeEntraAuthorizationCode,
    getEntraConfig,
    getEntraRedirectUri,
    getUsernameFromEntraClaims,
    isEntraConfigured,
    isEntraInteractiveFallbackEnabled
} from './index.js';

const originalEnv = { ...process.env };

function resetEnv() {
    process.env = { ...originalEnv };
}

describe('entra-auth utilities', () => {
    beforeEach(() => {
        resetEnv();
        process.env.ENTRA_CLIENT_ID = 'client-id';
        process.env.ENTRA_CLIENT_SECRET_ID = 'client-secret';
        process.env.ENTRA_TENANT_ID = 'tenant-id';
    });

    afterEach(() => {
        resetEnv();
    });

    it('returns Entra config from environment', () => {
        const config = getEntraConfig();

        assert.equal(config.clientId, 'client-id');
        assert.equal(config.clientSecret, 'client-secret');
        assert.equal(config.tenantId, 'tenant-id');
        assert.equal(config.scope, 'openid profile email');
    });

    it('reports configured only when all required values are present', () => {
        assert.equal(isEntraConfigured(), true);

        delete process.env.ENTRA_CLIENT_SECRET_ID;
        assert.equal(isEntraConfigured(), false);
    });

    it('builds redirect URI from request protocol and host', () => {
        const req = {
            protocol: 'https',
            get: (name) => (name === 'host' ? 'example.test' : undefined)
        };

        assert.equal(getEntraRedirectUri(req), 'https://example.test/auth/callback');
    });

    it('builds authorize URL with expected parameters', () => {
        const req = {
            protocol: 'https',
            get: (name) => (name === 'host' ? 'example.test' : undefined)
        };

        const url = buildEntraAuthorizeUrl(req, 'state-1', 'nonce-1');

        assert.match(
            url,
            /^https:\/\/login\.microsoftonline\.com\/tenant-id\/oauth2\/v2\.0\/authorize\?/
        );
        assert.match(url, /client_id=client-id/);
        assert.match(url, /response_type=code/);
        assert.match(url, /state=state-1/);
        assert.match(url, /nonce=nonce-1/);
    });

    it('adds optional authorize parameters when provided', () => {
        const req = {
            protocol: 'https',
            get: (name) => (name === 'host' ? 'example.test' : undefined)
        };

        const url = buildEntraAuthorizeUrl(req, 'state-1', 'nonce-1', {
            prompt: 'none',
            loginHint: 'user@example.com',
            domainHint: 'organizations'
        });

        assert.match(url, /prompt=none/);
        assert.match(url, /login_hint=user%40example\.com/);
        assert.match(url, /domain_hint=organizations/);
    });

    it('enables interactive fallback by default when env is unset', () => {
        delete process.env.ENTRA_INTERACTIVE_FALLBACK;
        assert.equal(isEntraInteractiveFallbackEnabled(), true);
    });

    it('supports disabling interactive fallback using env flag', () => {
        process.env.ENTRA_INTERACTIVE_FALLBACK = 'false';
        assert.equal(isEntraInteractiveFallbackEnabled(), false);
    });

    it('exchanges authorization code with token endpoint', async () => {
        const originalPost = got.post;

        try {
            got.post = (url, options) => {
                assert.equal(url, 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
                assert.equal(options.form.grant_type, 'authorization_code');
                assert.equal(options.form.client_id, 'client-id');
                assert.equal(options.form.client_secret, 'client-secret');
                assert.equal(options.form.code, 'auth-code');
                assert.equal(options.form.redirect_uri, 'https://example.test/auth/callback');

                return {
                    json: async () => ({ id_token: 'id-token' })
                };
            };

            const req = {
                protocol: 'https',
                get: (name) => (name === 'host' ? 'example.test' : undefined)
            };

            const response = await exchangeEntraAuthorizationCode(req, 'auth-code');
            assert.deepEqual(response, { id_token: 'id-token' });
        } finally {
            got.post = originalPost;
        }
    });

    it('decodes id token and validates nonce', () => {
        const claims = { sub: '123', nonce: 'nonce-1' };
        const idToken = [
            Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
            Buffer.from(JSON.stringify(claims)).toString('base64url'),
            ''
        ].join('.');

        const decoded = decodeAndValidateEntraIdToken(idToken, 'nonce-1');
        assert.equal(decoded.sub, '123');
    });

    it('throws when id token nonce does not match', () => {
        const claims = { sub: '123', nonce: 'nonce-2' };
        const idToken = [
            Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
            Buffer.from(JSON.stringify(claims)).toString('base64url'),
            ''
        ].join('.');

        assert.throws(
            () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
            /Invalid Entra nonce claim/
        );
    });

    it('extracts preferred username with fallback order', () => {
        assert.equal(
            getUsernameFromEntraClaims({ preferred_username: 'preferred@example.com' }),
            'preferred@example.com'
        );
        assert.equal(
            getUsernameFromEntraClaims({ email: 'email@example.com' }),
            'email@example.com'
        );
        assert.equal(getUsernameFromEntraClaims({ upn: 'upn@example.com' }), 'upn@example.com');
        assert.equal(getUsernameFromEntraClaims({ sub: 'sub-1' }), 'sub-1');
    });
});
