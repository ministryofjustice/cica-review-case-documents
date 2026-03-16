import { DateTime } from 'luxon';

const possibleDateFormats = {
    dayMonthYear: [
        'd MMM yy',
        'd MMM yyyy',
        'd MMMM yy',
        'd MMMM yyyy',
        'dd MMM yy',
        'dd MMM yyyy',
        'dd MMMM yy',
        'dd MMMM yyyy'
    ],
    numeric: [
        'd M yy',
        'd M yyyy',
        'd MM yy',
        'd MM yyyy',
        'dd M yy',
        'dd M yyyy',
        'dd MM yy',
        'dd MM yyyy'
    ],
    monthYear: ['MMM yy', 'MMM yyyy', 'MMMM yy', 'MMMM yyyy'],
    yearMonthDay: [
        'yyyy M d',
        'yyyy M dd',
        'yyyy MM d',
        'yyyy MM dd',
        'yyyy MMM d',
        'yyyy MMM dd',
        'yyyy MMMM d',
        'yyyy MMMM dd'
    ]
};
/**
 * Generates all possible formatted variants for a given date string, based on matched date patterns.
 *
 * This function:
 * 1. Determines relevant date format templates (day/month/year, numeric, month-year, year-month-day) based on detected patterns.
 * 2. Attempts to parse the input date string using each relevant format (locale: en-gb).
 * 3. If parsing succeeds, produces all possible variants by formatting the parsed date with each template.
 *
 * Supported format tokens:
 * - Day: `d`, `dd`
 * - Month: `M`, `MM`, `MMM`, `MMMM`
 * - Year: `yy`, `yyyy`
 *
 * Supported input examples:
 * - Numeric: `1/1/24`, `01-01-2024`, `12 05 2024`
 * - Month name: `01 Jan 2024`, `January-2024`, `Jan 24`
 * - Year-month-day (space-separated after normalisation): `2024 05 12`
 *
 * Output examples (space-separated):
 * - `1 Jan 2024`, `01 January 24`, `Jan 2024`, `January 2024`, `12 May 2024`
 *
 * Limitations:
 * - All non-alphanumeric delimiters in the input (such as `/`, `-`, `,`) are normalised to single spaces before parsing.
 * - Only formats specified in `possibleDateFormats` are generated.
 * - Input must match at least one relevant pattern for parsing to succeed.
 * - Locale is fixed to 'en-gb'.
 * - Returns an empty array if parsing fails.
 *
 * @param {string} dateString - The user-provided date string to parse and format (e.g. "1/1/24", "01 Jan 2024", "January-2024").
 * @param {Object} matchedPatterns - Object indicating which date patterns were matched (e.g. `{ dayMonthYear: true, numeric: false }`).
 *
 * @returns {string[]} Array of unique formatted date variants. Empty if input cannot be parsed.
 */
function generateDateFormatVariants(dateString, matchedPatterns = {}) {
    const relevantDateFormats = [];

    // build the list of relevant date formats to try based on which patterns were matched.
    for (const [pattern, isMatched] of Object.entries(matchedPatterns)) {
        if (isMatched) {
            relevantDateFormats.push(...possibleDateFormats[pattern]);
        }
    }

    // parse the inputted date to see if it is valid and to get the date
    // components. Then use the date components to generate the date
    // variants in the correct format.
    const dateVariants = new Set();
    let validDate = null;
    for (const dateFormat of relevantDateFormats) {
        const parsedDate = DateTime.fromFormat(normaliseDateString(dateString), dateFormat, {
            locale: 'en-gb'
        });

        if (parsedDate.isValid) {
            validDate = parsedDate;
            break;
        }
    }

    if (validDate) {
        for (const dateFormat of relevantDateFormats) {
            const formatted = validDate.toFormat(dateFormat);
            dateVariants.add(formatted);
            // also emit variants with 'Sept' if the formatted string uses 'Sep' as a standalone month abbreviation.
            const septVariant = formatted.replace(/\bSep\b/gi, 'Sept');
            if (septVariant !== formatted) {
                dateVariants.add(septVariant);
            }
        }
    }

    return Array.from(dateVariants);
}

/**
 * Normalises a date string by:
 * - Trimming leading/trailing whitespace
 * - Replacing non-alphanumeric delimiters with spaces
 * - Stripping ordinal suffixes from day numbers (e.g. "1st" -> "1")
 * - Normalising "Sept" to "Sep" for month abbreviations
 * - Collapsing multiple spaces into a single space
 *
 * This ensures consistent formatting before attempting to parse
 * with Luxon's `DateTime.fromFormat`.
 *
 * @param {string} dateString - Raw date string input.
 * @returns {string} A cleaned, space-normalised date string.
 */
function normaliseDateString(dateString) {
    return dateString
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, ' ') // replace any delimiter with space.
        .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1') // strip ordinal suffixes from day numbers.
        .replace(/\bSept\b/gi, 'Sep') // normalise 'Sept' to 'Sep' for parsing.
        .replace(/\s+/g, ' '); // collapse multiple spaces.
}

export default generateDateFormatVariants;
