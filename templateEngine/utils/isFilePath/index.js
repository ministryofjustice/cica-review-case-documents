'use strict';

/**
 * Checks whether a given string matches a simple file path pattern.
 *
 * This function tests if the input string resembles a file path by matching it
 * against a regular expression. The regex looks for alphanumeric characters,
 * forward slashes (`/`), or hyphens (`-`), optionally followed by a period (`.`)
 * and an extension of up to four characters.
 *
 * @example
 * // Returns true
 * isFilePath('index/cookies.njk');
 *
 * @example
 * // Returns false
 * isFilePath('not/a/valid\\path');
 *
 * @param {string} string - The string to test as a file path.
 * @returns {boolean} `true` if the string matches the file path pattern, otherwise `false`.
 */
function isFilePath(string) {
    return /^([a-zA-Z0-9/-]*[.*].{0,4})$/.test(string);
}

export default isFilePath;
