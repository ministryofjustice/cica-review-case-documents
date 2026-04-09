export const SESSION_KEYS_TO_PRESERVE_ON_AUTH_REGENERATION = [
    'returnTo',
    'caseSelected',
    'caseReferenceNumber'
];

/**
 * Regenerates the current Express session to mitigate session fixation.
 *
 * @param {import('express').Request} req - Express request carrying the active session.
 * @returns {Promise<void>}
 */
export function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

/**
 * Copies a fixed set of session values to preserve across session regeneration.
 *
 * @param {import('express-session').Session & Partial<import('express-session').SessionData>} session - Existing session.
 * @returns {Partial<import('express-session').SessionData>} Session values to restore.
 */
export function getSessionValuesToPreserve(session) {
    return SESSION_KEYS_TO_PRESERVE_ON_AUTH_REGENERATION.reduce((acc, key) => {
        if (session?.[key] !== undefined) {
            acc[key] = session[key];
        }

        return acc;
    }, {});
}

/**
 * Extracts an AADSTS error code from an Entra error description string.
 *
 * @param {string | undefined} description - Optional Entra error description text.
 * @returns {string | undefined} Matched AADSTS code when present.
 */
export function getEntraErrorCode(description) {
    const match = String(description || '').match(/AADSTS\d+/);
    return match ? match[0] : undefined;
}

/**
 * Validates that a query parameter is a single non-empty string.
 *
 * Express query parsing may produce arrays for repeated parameters; those are
 * rejected to avoid parameter pollution edge cases.
 *
 * @param {unknown} value - Query parameter value from Express.
 * @returns {string | undefined} The original string value when valid.
 */
export function getSingleNonEmptyQueryParam(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    if (value.trim().length === 0) {
        return undefined;
    }

    return value;
}
