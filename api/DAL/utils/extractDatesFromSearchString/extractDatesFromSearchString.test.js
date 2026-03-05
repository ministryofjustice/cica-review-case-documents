import assert from 'node:assert';
import { describe, it } from 'node:test';
import extractDatesFromSearchString from './index.js';

describe('extractDatesFromSearchString', () => {
    it('should extract day-month-year format like "12 Jan 2024"', () => {
        const input = 'Meeting on 12 Jan 2024 at office';
        const expected = {
            dates: ['12 Jan 2024'],
            remainingText: 'Meeting on at office'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should extract month-year format like "Jan 2024"', () => {
        const input = 'Report due Jan 2024';
        const expected = {
            dates: ['Jan 2024'],
            remainingText: 'Report due'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should extract multiple numeric dates like "12/01/2024, 13-02-24, 14.03.2024"', () => {
        const input = 'Event dates: 12/01/2024, 13-02-24, 14.03.2024';
        const expected = {
            dates: ['12/01/2024', '13-02-24', '14.03.2024'],
            remainingText: 'Event dates: , ,'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should return empty dates array if no dates are present', () => {
        const input = 'No dates here!';
        const expected = {
            dates: [],
            remainingText: 'No dates here!'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should extract multiple day-month-year dates in a string', () => {
        const input = 'Conference 12 Jan 2024-14 Jan 2024 in Paris';
        const expected = {
            dates: ['12 Jan 2024', '14 Jan 2024'],
            remainingText: 'Conference - in Paris'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should extract numeric dates with mixed formats like "1/2/23" and "3/4/2024"', () => {
        const input = 'Payment due 1/2/23 and 3/4/2024';
        const expected = {
            dates: ['1/2/23', '3/4/2024'],
            remainingText: 'Payment due and'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should extract multiple month-year dates with different separators', () => {
        const input = 'Multiple months: Feb 2023, March-2024, Dec 24';
        const expected = {
            dates: ['Feb 2023', 'March-2024', 'Dec 24'],
            remainingText: 'Multiple months: , ,'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should handle edge case of dates at the start and end of the string', () => {
        const input = '12 Jan 2024 Meeting at office on 13 Feb 2024';
        const expected = {
            dates: ['12 Jan 2024', '13 Feb 2024'],
            remainingText: 'Meeting at office on'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should handle edge case of adjacent dates without separators', () => {
        const input = 'Dates: 12Jan2024 and 13Feb2024';
        const expected = {
            dates: ['12Jan2024', '13Feb2024'],
            remainingText: 'Dates: and'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should handle edge case of dates with extra whitespace and separators', () => {
        const input = 'Event on  12 Jan 2024 ,  and 13 Feb 2024.';
        const expected = {
            dates: ['12 Jan 2024', '13 Feb 2024'],
            remainingText: 'Event on , and .'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });

    it('should handle edge case of month-year dates with different separators', () => {
        const input = 'Feb 2023 and March-2024 events';
        const expected = {
            dates: ['Feb 2023', 'March-2024'],
            remainingText: 'and events'
        };
        const result = extractDatesFromSearchString(input);
        assert.deepStrictEqual(result, expected);
    });
});
