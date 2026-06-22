import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/utils/apiJwtClaims/index.js';

/**
 * Creates a short-lived JWT for APP -> API communication.
 *
 * @param {string | undefined} username - Optional username from session.
 * @param {string | undefined} id - Optional stable user ID (Entra oid) for rate limiting.
 * @returns {string} A signed JWT token.
 */
export default function createApiJwtToken(id) {
    if (!process.env.APP_JWT_SECRET) {
        throw new Error('APP_JWT_SECRET environment variable is not set');
    }

    const payload = { id: id || 'app-ui' };

    return jwt.sign(payload, process.env.APP_JWT_SECRET, {
        expiresIn: process.env.APP_API_JWT_EXPIRES_IN || '60s',
        issuer: getApiJwtIssuer(),
        audience: getApiJwtAudience(),
        algorithm: 'HS256'
    });
}
