/**
 * Returns the options for configuring a JWT cookie.
 *
 * @returns {Object} Cookie options for JWT.
 * @returns {boolean} return.httpOnly - Indicates if the cookie is HTTP only.
 * @returns {boolean} return.secure - Indicates if the cookie should be sent only over HTTPS (true in production).
 * @returns {string} return.sameSite - Controls whether the cookie is sent with cross-site requests ('lax').
 * @returns {number} return.maxAge - Maximum age of the cookie in milliseconds, defaults to 1 hour if not set.
 */
export default function getJwtCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: Number(process.env.JWT_COOKIE_MAX_AGE) || 60 * 60 * 1000
    };
}
