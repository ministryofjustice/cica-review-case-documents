import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import createApiJwtToken from './create-api-jwt-token.js';

// Config is injected directly, so these tests do not read or mutate process.env
// and are safe to run without process isolation.
const CONFIG = {
    secret: 'test-secret',
    issuer: 'test-ui',
    audience: 'test-api',
    expiresIn: '60s'
};

describe('createApiJwtToken', () => {
    it('creates a signed token with provided oid as id', () => {
        const token = createApiJwtToken('entra-oid-123', CONFIG);
        const payload = jwt.verify(token, CONFIG.secret, {
            issuer: CONFIG.issuer,
            audience: CONFIG.audience
        });

        assert.equal(payload.id, 'entra-oid-123');
        assert.equal(payload.iss, 'test-ui');
        assert.equal(payload.aud, 'test-api');
    });

    it('creates a signed token with whitespace trimmed provided oid as id', () => {
        const token = createApiJwtToken('entra-oid-123 ', CONFIG);
        const payload = jwt.verify(token, CONFIG.secret, {
            issuer: CONFIG.issuer,
            audience: CONFIG.audience
        });

        assert.equal(payload.id, 'entra-oid-123');
        assert.equal(payload.iss, 'test-ui');
        assert.equal(payload.aud, 'test-api');
    });

    it('throws when oid is missing', () => {
        assert.throws(
            () => createApiJwtToken(undefined, CONFIG),
            /An Entra oid is required to create an API JWT token/
        );
    });

    it('throws when oid is whitespace', () => {
        assert.throws(
            () => createApiJwtToken(' ', CONFIG),
            /An Entra oid is required to create an API JWT token/
        );
    });

    it('throws if secret is not set', () => {
        assert.throws(
            () => createApiJwtToken('entra-oid-123', { ...CONFIG, secret: undefined }),
            /APP_JWT_SECRET environment variable is not set/
        );
    });

    it('throws if issuer is not set', () => {
        assert.throws(
            () => createApiJwtToken('entra-oid-123', { ...CONFIG, issuer: undefined }),
            /APP_API_JWT_ISSUER environment variable is not set/
        );
    });

    it('throws if audience is not set', () => {
        assert.throws(
            () => createApiJwtToken('entra-oid-123', { ...CONFIG, audience: undefined }),
            /APP_API_JWT_AUDIENCE environment variable is not set/
        );
    });
});
