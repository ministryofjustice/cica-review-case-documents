import assert from 'node:assert';
import { describe, it } from 'node:test';
import extractDatesFromSearchString from './index.js';

describe('extractDatesFromSearchString', () => {
    describe('Month name formats', () => {
        it('Should extract date with short month name', () => {
            const input = 'Appointment 12 Jan 2024 scheduled';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['12 Jan 2024'],
                remainingText: 'Appointment scheduled',
                matchedPatterns: [
                    {
                        dayMonthYear: true
                    }
                ]
            });
        });

        it('Should extract date with long month name', () => {
            const input = 'Hearing 5 September 2024 confirmed';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['5 September 2024'],
                remainingText: 'Hearing confirmed',
                matchedPatterns: [
                    {
                        dayMonthYear: true
                    }
                ]
            });
        });

        it('Should extract month-year with short month', () => {
            const input = 'Review Jan 24 completed';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['Jan 24'],
                remainingText: 'Review completed',
                matchedPatterns: [
                    {
                        monthYear: true
                    }
                ]
            });
        });

        it('Should extract month-year with long month', () => {
            const input = 'Review September 2024 completed';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['September 2024'],
                remainingText: 'Review completed',
                matchedPatterns: [
                    {
                        monthYear: true
                    }
                ]
            });
        });
    });

    describe('Year-month-day numeric format', () => {
        it('Should extract year-month-day format', () => {
            const input = 'Case 2024-05-12 opened';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['2024-05-12'],
                remainingText: 'Case opened',
                matchedPatterns: [
                    {
                        yearMonthDay: true
                    }
                ]
            });
        });
    });

    describe('Day-month-year numeric format', () => {
        it('Should extract slash separated date', () => {
            const input = 'Deadline 12/05/2024 submission';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024'],
                remainingText: 'Deadline submission',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract dash separated date', () => {
            const input = 'Event on 12-05-2024 confirmed';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12-05-2024'],
                remainingText: 'Event on confirmed',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract date with spaces around separators', () => {
            const input = 'Meeting 12 / 05 / 2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12 / 05 / 2024'],
                remainingText: 'Meeting scheduled',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract dot separated date', () => {
            const input = 'Date 12.05.2024 recorded';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12.05.2024'],
                remainingText: 'Date recorded',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract date with unicode dash', () => {
            const input = 'Meeting 12 – 05 – 2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12 – 05 – 2024'],
                remainingText: 'Meeting scheduled',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract a date with a 2-digit year', () => {
            const input = 'Payment due 1/2/23 now';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['1/2/23'],
                remainingText: 'Payment due now',
                matchedPatterns: [
                    {
                        numeric: true
                    }
                ]
            });
        });
    });

    describe('Ordinal day formats', () => {
        it('Should extract ordinal day date', () => {
            const input = 'Appointment 1st Jan 2024 scheduled';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: ['1st Jan 2024'],
                remainingText: 'Appointment scheduled',
                matchedPatterns: [
                    {
                        dayMonthYear: true
                    }
                ]
            });
        });
    });

    describe('Unsupported date formats', () => {
        it('should not extract invalid day', () => {
            const input = 'Date 50/4/92 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 50/4/92 invalid',
                matchedPatterns: []
            });
        });

        it('should not extract invalid year length', () => {
            const input = 'Date 17/10/123 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 17/10/123 invalid',
                matchedPatterns: []
            });
        });

        it('should not extract invalid month', () => {
            const input = 'Date 12/13/2024 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 12/13/2024 invalid',
                matchedPatterns: []
            });
        });

        it('should not extract invalid day 32', () => {
            const input = 'Date 32/01/2024 invalid';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Date 32/01/2024 invalid',
                matchedPatterns: []
            });
        });

        it('Should not extract dates embedded in words', () => {
            const input = 'abc12/05/2024xyz';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'abc12/05/2024xyz',
                matchedPatterns: []
            });
        });

        it('Should not extract concatenated numeric date', () => {
            const input = 'Case 17102024 closed';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Case 17102024 closed',
                matchedPatterns: []
            });
        });

        it('Should not extract date with no separator between day and month name', () => {
            const input = 'Appointment 12Jan2024 scheduled';
            const result = extractDatesFromSearchString(input);
            assert.deepStrictEqual(result, {
                dates: [],
                remainingText: 'Appointment 12Jan2024 scheduled',
                matchedPatterns: []
            });
        });
    });

    describe('Multiple dates in the same string', () => {
        it('Should extract multiple dates separated by spaces', () => {
            const input = 'Meeting 12/05/2024 13/06/2024 scheduled';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'Meeting scheduled',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract multiple dates separated by commas', () => {
            const input = 'Events: 12/05/2024, 13/06/2024, 14/07/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024', '14/07/2024'],
                remainingText: 'Events: , ,',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract dates in a date range', () => {
            const input = 'Conference 12/05/2024-14/05/2024 Berlin';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '14/05/2024'],
                remainingText: 'Conference - Berlin',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract adjacent dates without spaces', () => {
            const input = 'Dates:12/05/2024,13/05/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/05/2024'],
                remainingText: 'Dates:,',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract multiple dates with different separators', () => {
            const input = 'Archive 12-05-2024 14/07/24';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12-05-2024', '14/07/24'],
                remainingText: 'Archive',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract dates at start and end of string', () => {
            const input = '12/05/2024 meeting discussion 13/06/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'meeting discussion',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should ignore invalid dates while extracting valid ones', () => {
            const input = 'Dates 12/05/2024 50/04/92 13/06/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024'],
                remainingText: 'Dates 50/04/92',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract multiple short-year dates', () => {
            const input = 'Payments 1/2/23 3/4/24 confirmed';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['1/2/23', '3/4/24'],
                remainingText: 'Payments confirmed',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract dates separated by unicode dash', () => {
            const input = 'Travel 12/05/2024–14/05/2024';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '14/05/2024'],
                remainingText: 'Travel –',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });

        it('Should extract many dates from a long query', () => {
            const input = 'report 12/05/2024 budget 13/06/2024 meeting 14/07/2024 summary';
            const result = extractDatesFromSearchString(input);

            assert.deepStrictEqual(result, {
                dates: ['12/05/2024', '13/06/2024', '14/07/2024'],
                remainingText: 'report budget meeting summary',
                matchedPatterns: [
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    },
                    {
                        numeric: true
                    }
                ]
            });
        });
    });
});
