/**
 * Returns the expected JWT issuer for APP -> API tokens.
 *
 * @returns {string}
 */
export function getApiJwtIssuer() {
    if (!process.env.APP_API_JWT_ISSUER) {
        throw new Error('APP_API_JWT_ISSUER environment variable is not set');
    }
    return process.env.APP_API_JWT_ISSUER;
}

/**
 * Returns the expected JWT audience for APP -> API tokens.
 *
 * @returns {string}
 */
export function getApiJwtAudience() {
    if (!process.env.APP_API_JWT_AUDIENCE) {
        throw new Error('APP_API_JWT_AUDIENCE environment variable is not set');
    }
    return process.env.APP_API_JWT_AUDIENCE;
}
