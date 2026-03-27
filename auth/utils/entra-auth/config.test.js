import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
    buildEntraAuthorizeUrl,
    getEntraConfig,
    getEntraRedirectUri,
    isEntraConfigured,
    isEntraInteractiveFallbackEnabled
} from './config.js';

const originalEnv = { ...process.env };

/**
 * Restores process environment variables to their initial test snapshot.
 */
function resetEnv() {
    process.env = { ...originalEnv };
}

describe('entra-auth config utilities', () => {
    beforeEach(() => {
        resetEnv();
        process.env.ENTRA_CLIENT_ID = 'client-id';
        process.env.ENTRA_CLIENT_SECRET = 'client-secret';
        process.env.ENTRA_TENANT_ID = 'tenant-id';
        process.env.APP_BASE_URL = 'https://example.test';
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

    it('uses custom scope from environment when provided', () => {
        process.env.ENTRA_SCOPE = 'openid profile api://example/read';

        const config = getEntraConfig();

        assert.equal(config.scope, 'openid profile api://example/read');
    });

    it('reports configured only when all required values are present', () => {
        assert.equal(isEntraConfigured(), true);

        delete process.env.ENTRA_CLIENT_SECRET;
        assert.equal(isEntraConfigured(), false);
    });

    it('builds redirect URI from APP_BASE_URL when configured', () => {
        process.env.APP_BASE_URL = 'https://public.example.gov.uk/';
        const req = {
            protocol: 'https',
            get: () => 'spoofed.example.test'
        };

        assert.equal(getEntraRedirectUri(req), 'https://public.example.gov.uk/auth/callback');
    });

    it('throws when APP_BASE_URL is missing', () => {
        delete process.env.APP_BASE_URL;

        const req = {
            protocol: 'https',
            get: (name) => (name === 'host' ? 'example.test' : undefined)
        };

        assert.throws(
            () => getEntraRedirectUri(req),
            /APP_BASE_URL must be set for Entra redirect URI/
        );
    });

    it('throws when APP_BASE_URL is blank', () => {
        process.env.APP_BASE_URL = '   ';

        const req = {
            protocol: 'http',
            get: (name) => (name === 'host' ? 'local.test:5000' : undefined)
        };

        assert.throws(
            () => getEntraRedirectUri(req),
            /APP_BASE_URL must be set for Entra redirect URI/
        );
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
});
