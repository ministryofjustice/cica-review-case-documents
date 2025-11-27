/**
 * Retrieves authentication configuration from environment variables.
 *
 * @returns {{ secret: string | undefined, usernames: string[] }}
 *   An object containing the authentication secret and an array of usernames.
 *
 * @example
 * // Assuming process.env.AUTH_SECRET_PASSWORD = 'mySecret'
 * // and process.env.AUTH_USERNAMES = 'user1,user2'
 * const config = getAuthConfig();
 * // config = { secret: 'mySecret', usernames: ['user1', 'user2'] }
 */
export function getAuthConfig() {
    const secret = process.env.AUTH_SECRET_PASSWORD;
    const usernames = (process.env.AUTH_USERNAMES || '')
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);
    return { secret, usernames };
}
