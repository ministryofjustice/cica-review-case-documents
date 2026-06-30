import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/utils/apiJwtClaims/index.js';

/**
 * Creates a short-lived JWT for APP -> API communication.
 *
 * @param {string} id - Stable user ID (Entra oid) for rate limiting.
 * @returns {string} A signed JWT token.
 */
export default function createApiJwtToken(id) {
    if (!process.env.APP_JWT_SECRET) {
        throw new Error('APP_JWT_SECRET environment variable is not set');
    }

    const normalisedId = typeof id === 'string' ? id.trim() : id;

    if (normalisedId == null || normalisedId === '') {
        throw new Error('An Entra oid is required to create an API JWT token');
    }
    const payload = { id: normalisedId };

    return jwt.sign(payload, process.env.APP_JWT_SECRET, {
        expiresIn: process.env.APP_API_JWT_EXPIRES_IN || '60s',
        issuer: getApiJwtIssuer(),
        audience: getApiJwtAudience(),
        algorithm: 'HS256'
    });
}
