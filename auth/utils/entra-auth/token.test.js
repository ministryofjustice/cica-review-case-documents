import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import got from 'got';
import jwt from 'jsonwebtoken';
import {
    __clearEntraJwksCache,
    decodeAndValidateEntraIdToken,
    exchangeEntraAuthorizationCode
} from './token.js';

const originalEnv = { ...process.env };

/**
 * Restores process environment variables to their initial test snapshot.
 */
function resetEnv() {
    process.env = { ...originalEnv };
}

describe('entra-auth token utilities', () => {
    beforeEach(() => {
        resetEnv();
        __clearEntraJwksCache();
        process.env.ENTRA_CLIENT_ID = 'client-id';
        process.env.ENTRA_CLIENT_SECRET = 'client-secret';
        process.env.ENTRA_TENANT_ID = 'tenant-id';
    });

    afterEach(() => {
        resetEnv();
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

    it('verifies id token signature and validates nonce', async () => {
        const originalGet = got.get;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'test-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

            got.get = (url) => {
                assert.equal(
                    url,
                    'https://login.microsoftonline.com/tenant-id/discovery/v2.0/keys'
                );
                return {
                    json: async () => ({ keys: [jwk] })
                };
            };

            const idToken = jwt.sign(
                {
                    sub: '123',
                    nonce: 'nonce-1',
                    tid: 'tenant-id',
                    preferred_username: 'user@example.com'
                },
                privateKey,
                {
                    algorithm: 'RS256',
                    keyid: kid,
                    issuer,
                    audience: 'client-id',
                    expiresIn: '5m'
                }
            );

            const claims = await decodeAndValidateEntraIdToken(idToken, 'nonce-1');
            assert.equal(claims.sub, '123');
        } finally {
            got.get = originalGet;
        }
    });

    it('reuses cached signing keys between token validations', async () => {
        const originalGet = got.get;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'cached-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };
            let getCount = 0;

            got.get = () => {
                getCount += 1;
                return {
                    json: async () => ({ keys: [jwk] })
                };
            };

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await decodeAndValidateEntraIdToken(idToken, 'nonce-1');
            await decodeAndValidateEntraIdToken(idToken, 'nonce-1');

            assert.equal(getCount, 1);
        } finally {
            got.get = originalGet;
        }
    });

    it('refreshes JWKS when a token kid is missing from cache', async () => {
        const originalGet = got.get;

        try {
            const { privateKey: firstPrivateKey, publicKey: firstPublicKey } = generateKeyPairSync(
                'rsa',
                { modulusLength: 2048 }
            );
            const { privateKey: secondPrivateKey, publicKey: secondPublicKey } =
                generateKeyPairSync('rsa', {
                    modulusLength: 2048
                });
            const firstKid = 'old-kid';
            const secondKid = 'new-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const firstJwk = {
                ...firstPublicKey.export({ format: 'jwk' }),
                kid: firstKid,
                use: 'sig'
            };
            const secondJwk = {
                ...secondPublicKey.export({ format: 'jwk' }),
                kid: secondKid,
                use: 'sig'
            };
            let getCount = 0;

            got.get = () => {
                getCount += 1;
                return {
                    json: async () => ({
                        keys: getCount === 1 ? [firstJwk] : [firstJwk, secondJwk]
                    })
                };
            };

            const firstToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, firstPrivateKey, {
                algorithm: 'RS256',
                keyid: firstKid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            const secondToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, secondPrivateKey, {
                algorithm: 'RS256',
                keyid: secondKid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await decodeAndValidateEntraIdToken(firstToken, 'nonce-1');
            await decodeAndValidateEntraIdToken(secondToken, 'nonce-1');

            assert.equal(getCount, 2);
        } finally {
            got.get = originalGet;
        }
    });

    it('refreshes cached JWKS when cache TTL has expired', async () => {
        const originalGet = got.get;
        const originalNow = Date.now;

        try {
            process.env.ENTRA_JWKS_CACHE_TTL_MS = '5';

            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'ttl-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };
            let getCount = 0;
            let nowMs = 1000;

            Date.now = () => nowMs;

            got.get = () => {
                getCount += 1;
                return {
                    json: async () => ({ keys: [jwk] })
                };
            };

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await decodeAndValidateEntraIdToken(idToken, 'nonce-1');
            nowMs += 10;
            await decodeAndValidateEntraIdToken(idToken, 'nonce-1');

            assert.equal(getCount, 2);
        } finally {
            Date.now = originalNow;
            got.get = originalGet;
        }
    });

    it('throws when id token nonce does not match', async () => {
        const originalGet = got.get;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'test-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

            got.get = () => ({
                json: async () => ({ keys: [jwk] })
            });

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-2' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await assert.rejects(
                () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
                /Invalid Entra nonce claim/
            );
        } finally {
            got.get = originalGet;
        }
    });

    it('throws when id token header cannot be decoded', async () => {
        await assert.rejects(
            () => decodeAndValidateEntraIdToken('not-a-jwt-token', 'nonce-1'),
            /Invalid Entra id_token header/
        );
    });

    it('throws when id token kid header is missing', async () => {
        const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, 'test-secret', {
            algorithm: 'HS256',
            expiresIn: '5m'
        });

        await assert.rejects(
            () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
            /Missing Entra id_token kid header/
        );
    });

    it('throws when matching signing key cannot be found in JWKS', async () => {
        const originalGet = got.get;

        try {
            const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';

            got.get = () => ({
                json: async () => ({})
            });

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, privateKey, {
                algorithm: 'RS256',
                keyid: 'missing-kid',
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await assert.rejects(
                () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
                /Unable to find matching Entra signing key/
            );
        } finally {
            got.get = originalGet;
        }
    });

    it('throws when Entra configuration is missing for id_token validation', async () => {
        delete process.env.ENTRA_CLIENT_ID;

        await assert.rejects(
            () => decodeAndValidateEntraIdToken('not-used', 'nonce-1'),
            /Entra configuration missing for id_token validation/
        );
    });

    it('throws when jwt verification returns a non-object payload', async () => {
        const originalGet = got.get;
        const originalVerify = jwt.verify;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'test-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

            got.get = () => ({
                json: async () => ({ keys: [jwk] })
            });

            jwt.verify = () => 'string-payload';

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await assert.rejects(
                () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
                /Invalid Entra id_token payload/
            );
        } finally {
            jwt.verify = originalVerify;
            got.get = originalGet;
        }
    });

    it('throws when expected nonce is missing', async () => {
        const originalGet = got.get;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'test-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

            got.get = () => ({
                json: async () => ({ keys: [jwk] })
            });

            const idToken = jwt.sign({ sub: '123', nonce: 'nonce-1' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await assert.rejects(
                () => decodeAndValidateEntraIdToken(idToken, ''),
                /Missing expected Entra nonce/
            );
        } finally {
            got.get = originalGet;
        }
    });

    it('throws when id token nonce claim is missing', async () => {
        const originalGet = got.get;

        try {
            const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
            const kid = 'test-kid';
            const issuer = 'https://login.microsoftonline.com/tenant-id/v2.0';
            const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };

            got.get = () => ({
                json: async () => ({ keys: [jwk] })
            });

            const idToken = jwt.sign({ sub: '123' }, privateKey, {
                algorithm: 'RS256',
                keyid: kid,
                issuer,
                audience: 'client-id',
                expiresIn: '5m'
            });

            await assert.rejects(
                () => decodeAndValidateEntraIdToken(idToken, 'nonce-1'),
                /Missing Entra nonce claim/
            );
        } finally {
            got.get = originalGet;
        }
    });
});
