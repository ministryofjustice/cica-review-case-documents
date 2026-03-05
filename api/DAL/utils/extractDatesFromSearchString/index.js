/**
 * Extracts date-like substrings from a search string and returns both
 * the matched dates and the remaining non-date text.
 *
 * Supported date patterns include:
 * - Day–Month–Year (e.g. "12 Jan 2024", "12-01-2024", "12/01/24")
 * - Month–Year (e.g. "Jan 2024", "January-2024")
 * - Numeric-only formats with 2–3 parts (e.g. "12/01/2024", "12-01-24", "17102023")
 *
 * The regex is Unicode-aware and supports:
 * - Unicode spaces (`\p{Z}`)
 * - Unicode dashes (`\p{Pd}`)
 * - Common separators such as space, dash, dot, and slash
 *
 * Matched date substrings are removed from the original string,
 * and the remaining text is trimmed.
 *
 * @param {string} searchString - Raw user-entered search text that may contain date expressions.
 *
 * @returns {{ dates: string[], remainingText: string }}
 * An object containing:
 * - `dates`: An array of matched date-like substrings (empty if none found).
 * - `remainingText`: The input string with detected dates removed and whitespace trimmed.
 */
function extractDatesFromSearchString(searchString) {
    let remainingText = searchString;

    // separators: space, dash, dot, slash, unicode space/dash
    const separator = `[\\s./\\p{Z}\\p{Pd}]*`;

    const monthName = [
        `Jan(?:uary)?`,
        `Feb(?:ruary)?`,
        `Mar(?:ch)?`,
        `Apr(?:il)?`,
        `May`,
        `Jun(?:e)?`,
        `Jul(?:y)?`,
        `Aug(?:ust)?`,
        `Sep(?:t(?:ember)?)?`,
        `Oct(?:ober)?`,
        `Nov(?:ember)?`,
        `Dec(?:ember)?`
    ].join('|');

    const dayNumber = `\\d{1,2}`;
    const monthNumber = `\\d{1,2}`;
    const year = `\\d{2,4}`;

    // day-month-year. e.g. 12 Jan 2024, 12-01-2024, 12/01/24, 12Jan2024.
    const dayMonthYear = `${dayNumber}${separator}(?:${monthName})${separator}${year}`;

    // 12/01/2024, or 12-01-24, 17102023 (purely numeric, 2–3 parts)
    const numericDate = `${dayNumber}${separator}${monthNumber}${separator}${year}`;

    // month-year. e.g. Jan 2024, January-2024.
    const monthYear = `(?:${monthName})${separator}${year}`;

    // combine all variants.
    const datePattern = `(?<!\\w)(?:${dayMonthYear}|${numericDate}|${monthYear})(?!\\w)`;

    const dateRegex = new RegExp(datePattern, 'giu');

    // extract all matches.
    const matches = [];
    let match = dateRegex.exec(searchString);
    while (match !== null) {
        matches.push(match[0]);
        match = dateRegex.exec(searchString);
    }

    // remove dates from remaining text.
    remainingText = searchString.replace(dateRegex, '').replace(/\s+/g, ' ').trim();

    return {
        dates: matches,
        remainingText
    };
}

export default extractDatesFromSearchString;
