/**
 * Extracts date strings from a search query and returns the remaining text.
 *
 * Supports flexible date formats with optional whitespace and common separators (dot, slash, dash, Unicode dash).
 * Handles numeric, month-name, and ordinal day formats.
 *
 * Examples of supported formats:
 * - Numeric: `12/05/2024`, `12-05-2024`, `12 / 05 / 2024`, `12 – 05 – 2024`, `1/2/23`, `12.05.2024`, `2024-05-12`
 * - Month name: `12 Jan 2024`, `5 September 2024`, `Jan 24`, `September 2024`
 * - Ordinal day: `1st Jan 2024`, `21st February 2024` (ordinal suffixes supported)
 *
 * Limitations:
 * - Days: `1–31` (optionally with ordinal suffixes: st, nd, rd, th)
 * - Months: `1–12` (numeric), or English month names (short/long)
 * - Years: `2` or `4` digits
 * - Dates must not be embedded inside words
 * - No validation of real calendar dates (e.g., `31/02/2024` may match)
 * - Concatenated numeric dates (e.g., `17102024`) and formats without separators (e.g., `12Jan2024`) are not matched
 *
 * @param {string} searchString - The search query potentially containing date strings.
 *
 * @returns {{
 *   dates: string[],
 *   remainingText: string
 *   matchedPatterns: Array<Record<string, boolean>>
 * }} An object containing:
 * - `dates`: Array of extracted date strings in the order they appear
 * - `remainingText`: The original string with dates removed and whitespace normalized
 *
 * @example
 * extractDatesFromSearchString("report 12/05/2024 meeting 2024-10-19");
 * // {
 * //   dates: ["12/05/2024", "2024-10-19"],
 * //   remainingText: "report meeting",
 * //   matchedPatterns: [{threeParts: true}, {threeParts: true}]
 * // }
 *
 * extractDatesFromSearchString("Appointment 1st Jan 2024 scheduled");
 * // {
 * //   dates: ["1st Jan 2024"],
 * //   remainingText: "Appointment scheduled",
 * //   matchedPatterns: [{threeParts: true}]
 * // }
 */
function extractDatesFromSearchString(searchString) {
    let remainingText = searchString;

    // separators: space, dash, dot, slash, unicode space/dash
    const separator = `[\\s./\\p{Pd}]+`;

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

    const dayNumber = `(0?[1-9]|[12][0-9]|3[01])`;
    const dayNumberWithOrdinal = `(?:0?1(?:st)?|0?2(?:nd)?|0?3(?:rd)?|0?[4-9](?:th)?|1[0-9](?:th)?|2(?:0|[4-9])(?:th)?|21(?:st)?|22(?:nd)?|23(?:rd)?|30(?:th)?|31(?:st)?)`;
    const monthNumber = `(0?[1-9]|1[0-2])`;
    const year2Digit = `(\\d{2})`;
    const year4Digit = `(\\d{4})`;
    const year = `(?:${year4Digit}|${year2Digit})`;

    // day-month-year. e.g. 12 Jan 2024, 12 January 2024.
    const dayMonthYear = `${dayNumberWithOrdinal}${separator}(?:${monthNumber}|${monthName})${separator}${year}`;

    // month-year. e.g. Jan 2024, January-2024.
    const monthYear = `(?:${monthName})${separator}${year}`;

    // year-month-day. e.g. 2022-10-25, 2024-01-12.
    const yearMonthDay = `${year4Digit}${separator}(?:${monthNumber})${separator}${dayNumber}`;

    // combine all variants (with named groups).
    // order matters: most specific -> more general, to ensure correct matching and group detection.
    const datePattern = `(?<!\\w)(?:(?<threeParts>(?:${dayMonthYear}|${yearMonthDay}))|(?<twoParts>${monthYear}))(?!\\w)`;
    const dateRegex = new RegExp(datePattern, 'giu');

    // extract all matches and which pattern matched.
    const matches = [];
    const matchedPatterns = [];

    let match = dateRegex.exec(searchString);
    while (match !== null) {
        matches.push(match[0]);

        // detect which group matched.
        for (const key in match.groups) {
            const matchingGroups = {};
            if (match.groups[key]) {
                matchingGroups[key] = true;
            }
            if (Object.keys(matchingGroups).length !== 0) {
                matchedPatterns.push(matchingGroups);
            }
        }
        match = dateRegex.exec(searchString);
    }

    // remove dates from remaining text.
    remainingText = searchString.replace(dateRegex, '').replace(/\s+/g, ' ').trim();

    return {
        dates: matches,
        remainingText,
        matchedPatterns
    };
}

export default extractDatesFromSearchString;
