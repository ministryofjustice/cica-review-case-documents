/**
 * Extracts numeric date strings from a search query and returns the remaining text.
 *
 * Supports flexible numeric date formats with optional whitespace and common
 * separators (slash, dot, dash, or Unicode dash).
 *
 * Examples of supported formats:
 * - `12/05/2024`
 * - `12 / 05 / 2024`
 * - `12-05-2024`
 * - `12 – 05 – 2024`
 * - `12.05.2024`
 *
 * The function finds all matching dates, returns them as strings, and removes
 * them from the original search string to produce a cleaned `remainingText`.
 *
 * Notes:
 * - Days are restricted to `1–31`
 * - Months are restricted to `1–12`
 * - Years support `2` or `4` digits
 * - The regex ensures dates are not embedded inside words
 * - This function does **not validate real calendar dates** (e.g. `31/02/2024` may still match)
 *
 * @param {string} searchString - The search query potentially containing date strings.
 *
 * @returns {{
 *   dates: string[],
 *   remainingText: string
 * }} An object containing:
 * - `dates`: Array of extracted date strings in the order they appear
 * - `remainingText`: The original string with dates removed and whitespace normalized
 *
 * @example
 * extractDatesFromSearchString("report 12/05/2024 meeting 01-02-24");
 * // {
 * //   dates: ["12/05/2024", "01-02-24"],
 * //   remainingText: "report meeting"
 * // }
 */
function extractDatesFromSearchString(searchString) {
    let remainingText = searchString;

    // separators: space, dash, dot, slash, unicode space/dash
    // 12/05/2024
    // 12 / 05 / 2024
    // 12-05-2024
    // 12 – 05 – 2024
    // 12.05.2024
    // 12 05 2024
    const separator = `[\\s/\\p{Pd}]+`;
    const dayNumber = `(0?[1-9]|[12][0-9]|3[01])`;
    const monthNumber = `(0?[1-9]|1[0-2])`;
    const year = `(\\d{2}|\\d{4})`;

    // 12/01/2024, or 12-01-24, 17 10 2023 (purely numeric, 2–3 parts)
    const numericDate = `${dayNumber}${separator}${monthNumber}${separator}${year}`;

    // combine all date variants.
    const datePattern = `(?<!\\w)(?:${numericDate})(?!\\w)`;

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
