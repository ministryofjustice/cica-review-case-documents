import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import createApiJwtToken from './create-api-jwt-token.js';

describe('createApiJwtToken', () => {
    it('creates a signed token with provided username', () => {
        process.env.APP_JWT_SECRET = 'test-secret';
        process.env.APP_API_JWT_EXPIRES_IN = '60s';
        process.env.APP_API_JWT_ISSUER = 'test-ui';
        process.env.APP_API_JWT_AUDIENCE = 'test-api';

        const token = createApiJwtToken('user@example.com');
        const payload = jwt.verify(token, process.env.APP_JWT_SECRET, {
            issuer: 'test-ui',
            audience: 'test-api'
        });

        assert.equal(payload.username, 'user@example.com');
        assert.equal(payload.iss, 'test-ui');
        assert.equal(payload.aud, 'test-api');
    });

    it('falls back to app-ui when username is missing', () => {
        process.env.APP_JWT_SECRET = 'test-secret';
        process.env.APP_API_JWT_EXPIRES_IN = '60s';
        process.env.APP_API_JWT_ISSUER = 'test-ui';
        process.env.APP_API_JWT_AUDIENCE = 'test-api';

        const token = createApiJwtToken();
        const payload = jwt.verify(token, process.env.APP_JWT_SECRET, {
            issuer: 'test-ui',
            audience: 'test-api'
        });

        assert.equal(payload.username, 'app-ui');
    });

    it('throws if APP_JWT_SECRET is not set', () => {
        const originalSecret = process.env.APP_JWT_SECRET;
        delete process.env.APP_JWT_SECRET;

        assert.throws(
            () => createApiJwtToken('user@example.com'),
            /APP_JWT_SECRET environment variable is not set/
        );

        process.env.APP_JWT_SECRET = originalSecret;
    });

    it('throws if APP_API_JWT_ISSUER is not set', () => {
        const originalIssuer = process.env.APP_API_JWT_ISSUER;
        process.env.APP_JWT_SECRET = 'test-secret';
        delete process.env.APP_API_JWT_ISSUER;
        process.env.APP_API_JWT_AUDIENCE = 'test-api';

        assert.throws(
            () => createApiJwtToken('user@example.com'),
            /APP_API_JWT_ISSUER environment variable is not set/
        );

        process.env.APP_API_JWT_ISSUER = originalIssuer;
    });

    it('throws if APP_API_JWT_AUDIENCE is not set', () => {
        const originalAudience = process.env.APP_API_JWT_AUDIENCE;
        process.env.APP_JWT_SECRET = 'test-secret';
        process.env.APP_API_JWT_ISSUER = 'test-ui';
        delete process.env.APP_API_JWT_AUDIENCE;

        assert.throws(
            () => createApiJwtToken('user@example.com'),
            /APP_API_JWT_AUDIENCE environment variable is not set/
        );

        process.env.APP_API_JWT_AUDIENCE = originalAudience;
    });
});
