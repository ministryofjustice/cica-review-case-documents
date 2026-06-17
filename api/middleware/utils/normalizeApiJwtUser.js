/**
 * Normalizes API JWT claims so downstream middleware can rely on req.user.id.
 * Supports payloads where identity is provided as id, userId, or username.
 *
 * @param {*} user - Decoded JWT payload.
 * @returns {*} Normalized user payload.
 */
export default function normalizeApiJwtUser(user) {
    if (!user || typeof user !== 'object') {
        return user;
    }

    const rawId = user.id ?? user.userId ?? user.username;
    const normalizedId = typeof rawId === 'string' ? rawId.trim() : rawId;
    if (normalizedId == null || normalizedId === '') {
        return user;
    }

    return {
        ...user,
        id: normalizedId
    };
}
