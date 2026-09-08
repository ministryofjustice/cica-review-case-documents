import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/utils/apiJwtClaims/index.js';

/**
 * Resolves the API JWT signing configuration from the environment.
 *
 * @returns {{ secret: string|undefined, issuer: string, audience: string, expiresIn: string }}
 */
function resolveConfigFromEnv() {
    return {
        secret: process.env.APP_JWT_SECRET,
        issuer: getApiJwtIssuer(),
        audience: getApiJwtAudience(),
        expiresIn: process.env.APP_API_JWT_EXPIRES_IN || '300s'
    };
}

/**
 * Creates a short-lived JWT for APP -> API communication.
 *
 * Configuration may be injected explicitly (preferred, and used by tests) or
 * resolved from the environment when omitted (the default used by request
 * handlers).
 *
 * @param {string} id - Stable user ID (Entra oid) for rate limiting.
 * @param {Object} [config] - Optional signing config. Resolved from env when omitted.
 * @param {string} [config.secret] - HMAC secret used to sign the token.
 * @param {string} [config.issuer] - Token issuer claim.
 * @param {string} [config.audience] - Token audience claim.
 * @param {string} [config.expiresIn] - Token lifetime (e.g. '300s').
 * @returns {string} A signed JWT token.
 */
export default function createApiJwtToken(id, config) {
    const { secret, issuer, audience, expiresIn } = config ?? resolveConfigFromEnv();

    if (!secret) {
        throw new Error('APP_JWT_SECRET environment variable is not set');
    }
    if (!issuer) {
        throw new Error('APP_API_JWT_ISSUER environment variable is not set');
    }
    if (!audience) {
        throw new Error('APP_API_JWT_AUDIENCE environment variable is not set');
    }

    const normalisedId = typeof id === 'string' ? id.trim() : id;

    if (normalisedId == null || normalisedId === '') {
        throw new Error('An Entra oid is required to create an API JWT token');
    }
    const payload = { id: normalisedId };

    return jwt.sign(payload, secret, {
        expiresIn: expiresIn || '300s',
        issuer,
        audience,
        algorithm: 'HS256'
    });
}
