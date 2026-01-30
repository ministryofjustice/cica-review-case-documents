/**
 * Utility functions for formatting text and metadata.
 */

/**
 * Formats text to sentence case after a dash.
 * Capitalizes the first letter after a dash while lowercasing the rest.
 * Only the first dash is considered for formatting.
 *
 * Example: 'TC19 - ADDITIONAL INFO REQUEST' -> 'TC19 - Additional info request'
 * Example: 'PREFIX - TEXT - MORE' -> 'PREFIX - Text - more'
 *
 * @param {string} str - The string to format
 * @returns {string} The formatted string
 */
export function toSentenceCaseAfterDash(str) {
    const dashIndex = str.indexOf(' - ');
    if (dashIndex === -1) {
        return str;
    }

    const prefix = str.substring(0, dashIndex + 3);
    const rest = str.substring(dashIndex + 3);
    return prefix + rest.toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/**
 * Formats page title for display, with fallback to default.
 *
 * @param {string|null|undefined} correspondenceType - The correspondence type from metadata
 * @param {string} [fallback='Document image'] - Default title if correspondence_type is not available
 * @returns {string} The formatted page title
 */
export function formatPageTitle(correspondenceType, fallback = 'Document image') {
    return correspondenceType ? toSentenceCaseAfterDash(correspondenceType) : fallback;
}
