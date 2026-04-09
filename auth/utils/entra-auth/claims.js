/**
 * Extracts a stable username from Entra claims.
 *
 * @param {Record<string, any>} claims - Decoded id token claims.
 * @returns {string}
 */
export function getUsernameFromEntraClaims(claims) {
    return claims.preferred_username || claims.email || claims.upn || claims.sub || 'entra-user';
}
