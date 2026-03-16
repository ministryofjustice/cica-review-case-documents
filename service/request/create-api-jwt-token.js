import jwt from 'jsonwebtoken';
import { getApiJwtAudience, getApiJwtIssuer } from '../../utils/apiJwtClaims.js';

/**
 * Creates a short-lived JWT for APP -> API communication.
 *
 * @param {string | undefined} username - Optional username from session.
 * @returns {string} A signed JWT token.
 */
export default function createApiJwtToken(username) {
    if (!process.env.APP_JWT_SECRET) {
        throw new Error('APP_JWT_SECRET environment variable is not set');
    }

    return jwt.sign({ username: username || 'app-ui' }, process.env.APP_JWT_SECRET, {
        expiresIn: process.env.APP_API_JWT_EXPIRES_IN || '60s',
        issuer: getApiJwtIssuer(),
        audience: getApiJwtAudience(),
        algorithm: 'HS256'
    });
}
