import assert from 'node:assert';
import { describe, it } from 'node:test';
import generateDateFormatVariants from './index.js';

describe('generateDateFormatVariants', () => {
    describe('Day-month-year with month name', () => {
        it('should generate variants for 2 Jan 2024', () => {
            const input = '2 Jan 2024';
            const matchedPatterns = { dayMonthYear: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('2 Jan 24'));
            assert(result.includes('2 Jan 2024'));
            assert(result.includes('02 Jan 24'));
            assert(result.includes('02 Jan 2024'));
            assert(result.includes('2 January 24'));
            assert(result.includes('2 January 2024'));
            assert(result.includes('02 January 24'));
            assert(result.includes('02 January 2024'));
        });
        it('should generate variants for 15 September 2024', () => {
            const input = '15 September 2024';
            const matchedPatterns = { dayMonthYear: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('15 Sep 24'));
            assert(result.includes('15 Sep 2024'));
            assert(result.includes('15 Sept 24'));
            assert(result.includes('15 Sept 2024'));
            assert(result.includes('15 September 24'));
            assert(result.includes('15 September 2024'));
        });
    });

    describe('Numeric day-month-year formats', () => {
        it('should generate variants for 1/1/24', () => {
            const input = '1/1/24';
            const matchedPatterns = { numeric: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('1 1 24'));
            assert(result.includes('1 1 2024'));
            assert(result.includes('1 01 24'));
            assert(result.includes('1 01 2024'));
            assert(result.includes('01 1 24'));
            assert(result.includes('01 1 2024'));
            assert(result.includes('01 01 24'));
            assert(result.includes('01 01 2024'));
        });
        it('should generate variants for 12-05-2024', () => {
            const input = '12-05-2024';
            const matchedPatterns = { numeric: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('12 5 24'));
            assert(result.includes('12 5 2024'));
            assert(result.includes('12 05 24'));
            assert(result.includes('12 05 2024'));
        });
        it('should generate variants for 01 01 2024', () => {
            const input = '01 01 2024';
            const matchedPatterns = { numeric: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('1 1 24'));
            assert(result.includes('1 1 2024'));
            assert(result.includes('1 01 24'));
            assert(result.includes('1 01 2024'));
            assert(result.includes('01 1 24'));
            assert(result.includes('01 1 2024'));
            assert(result.includes('01 01 24'));
            assert(result.includes('01 01 2024'));
        });
    });

    describe('Month-year formats', () => {
        it('should generate variants for Jan 24', () => {
            const input = 'Jan 24';
            const matchedPatterns = { monthYear: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('Jan 24'));
            assert(result.includes('Jan 2024'));
            assert(result.includes('January 24'));
            assert(result.includes('January 2024'));
        });
        it('should generate variants for January 2024', () => {
            const input = 'January 2024';
            const matchedPatterns = { monthYear: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('Jan 24'));
            assert(result.includes('Jan 2024'));
            assert(result.includes('January 24'));
            assert(result.includes('January 2024'));
        });
    });

    describe('Year-month-day formats', () => {
        it('should generate variants for 2024-03-12', () => {
            const input = '2024-03-12';
            const matchedPatterns = { yearMonthDay: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert(result.includes('2024 3 12'));
            assert(result.includes('2024 03 12'));
            assert(result.includes('2024 Mar 12'));
            assert(result.includes('2024 March 12'));
        });
    });

    describe('Edge cases and invalid input', () => {
        it('should return empty array for invalid date', () => {
            const input = 'not a date';
            const matchedPatterns = { numeric: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert.deepStrictEqual(result, []);
        });
        it('should return empty array if no patterns matched', () => {
            const input = '1/1/24';
            const matchedPatterns = {}; // no pattern previously matched.
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert.deepStrictEqual(result, []);
        });
        it('should handle ambiguous input gracefully', () => {
            const input = '2024/13/01';
            const matchedPatterns = { yearMonthDay: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert.deepStrictEqual(result, []);
        });
        it('should not generate variants for 24 8 1', () => {
            const input = '24 8 1';
            const matchedPatterns = { yearMonthDay: true };
            const result = generateDateFormatVariants(input, matchedPatterns);
            assert.deepStrictEqual(result, []);
        });
    });
});
