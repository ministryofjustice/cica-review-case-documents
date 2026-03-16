import assert from 'node:assert';
import { describe, it } from 'node:test';
import extractDatesFromSearchString from './index.js';

describe('extractDatesFromSearchString', () => {
    describe('Supported numeric date formats', () => {
        it('Should extract slash separated date', () => {
            const input = 'Deadline 12/05/2024 submission';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024'],
                remainingText: 'Deadline submission'
            });
        });

        it('Should extract dash separated date', () => {
            const input = 'Event on 12-05-2024 confirmed';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12-05-2024'],
                remainingText: 'Event on confirmed'
            });
        });

        it('Should extract date with spaces around separators', () => {
            const input = 'Meeting 12 / 05 / 2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12 / 05 / 2024'],
                remainingText: 'Meeting scheduled'
            });
        });

        it('Should extract date with unicode dash', () => {
            const input = 'Meeting 12 – 05 – 2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12 – 05 – 2024'],
                remainingText: 'Meeting scheduled'
            });
        });

        it('Should extract 2 digit year', () => {
            const input = 'Payment due 1/2/23 now';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['1/2/23'],
                remainingText: 'Payment due now'
            });
        });
    });

    describe('Unsupported numeric date formats', () => {
        it('should not match invalid day', () => {
            const input = 'Date 50/4/92 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 50/4/92 invalid'
            });
        });

        it('should not match invalid year length', () => {
            const input = 'Date 17/10/123 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 17/10/123 invalid'
            });
        });

        it('should not match invalid month', () => {
            const input = 'Date 12/13/2024 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 12/13/2024 invalid'
            });
        });

        it('should not match invalid day 32', () => {
            const input = 'Date 32/01/2024 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 32/01/2024 invalid'
            });
        });

        it('Should not match dates embedded in words', () => {
            const input = 'abc12/05/2024xyz';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'abc12/05/2024xyz'
            });
        });
    });

    describe('Multiple dates in the same string', () => {
        it('Should extract multiple dates separated by spaces', () => {
            const input = 'Meeting 12/05/2024 13/06/2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'Meeting scheduled'
            });
        });

        it('Should extract multiple dates separated by commas', () => {
            const input = 'Events: 12/05/2024, 13/06/2024, 14/07/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024', '14/07/2024'],
                remainingText: 'Events: , ,'
            });
        });

        it('Should extract dates in a date range', () => {
            const input = 'Conference 12/05/2024-14/05/2024 Berlin';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '14/05/2024'],
                remainingText: 'Conference - Berlin'
            });
        });

        it('Should extract adjacent dates without spaces', () => {
            const input = 'Dates:12/05/2024,13/05/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/05/2024'],
                remainingText: 'Dates:,'
            });
        });

        it('Should extract multiple dates with different separators', () => {
            const input = 'Archive 12-05-2024 14/07/24';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12-05-2024', '14/07/24'],
                remainingText: 'Archive'
            });
        });

        it('Should extract dates at start and end of string', () => {
            const input = '12/05/2024 meeting discussion 13/06/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'meeting discussion'
            });
        });

        it('Should ignore invalid dates while extracting valid ones', () => {
            const input = 'Dates 12/05/2024 50/04/92 13/06/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'Dates 50/04/92'
            });
        });

        it('Should extract multiple short-year dates', () => {
            const input = 'Payments 1/2/23 3/4/24 confirmed';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['1/2/23', '3/4/24'],
                remainingText: 'Payments confirmed'
            });
        });

        it('Should extract dates separated by unicode dash', () => {
            const input = 'Travel 12/05/2024–14/05/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '14/05/2024'],
                remainingText: 'Travel –'
            });
        });

        it('Should extract many dates from a long query', () => {
            const input = 'report 12/05/2024 budget 13/06/2024 meeting 14/07/2024 summary';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024', '14/07/2024'],
                remainingText: 'report budget meeting summary'
            });
        });
    });
});
