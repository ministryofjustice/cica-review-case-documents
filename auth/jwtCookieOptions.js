/**
 * Returns options for configuring JWT cookies.
 *
 * @returns {Object} Cookie options.
 * @returns {boolean} options.httpOnly - Ensures the cookie is accessible only by the web server.
 * @returns {boolean} options.secure - Sets the cookie to be sent only over HTTPS in production.
 * @returns {string} options.sameSite - Controls whether the cookie is sent with cross-site requests ('lax' mode).
 * @returns {number} options.maxAge - Specifies the cookie's expiration time in milliseconds (default: 1 hour).
 */

export default function getJwtCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: Number(process.env.JWT_COOKIE_MAX_AGE) || 60 * 60 * 1000
    };
}
