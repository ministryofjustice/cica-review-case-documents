import assert from 'node:assert';
import { describe, it } from 'node:test';
import buildQueryJson from './index.js';

describe('buildQueryJson', () => {
    it('Should build query with match_phrase for a single valid numeric date', () => {
        const params = {
            keyword: 'Meeting on 12/05/2024 at office',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 10
        };

        const expected = {
            from: 10,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '12 5 24' } },
                        { match_phrase: { chunk_text: '12 5 2024' } },
                        { match_phrase: { chunk_text: '12 05 24' } },
                        { match_phrase: { chunk_text: '12 05 2024' } },
                        {
                            match: {
                                chunk_text: { query: 'Meeting on at office', operator: 'or' }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query with only match for keyword with no valid dates', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5
        };

        const expected = {
            from: 0,
            size: 5,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match: { chunk_text: { query: 'Important meeting', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query with multiple numeric dates and remaining text', () => {
        const params = {
            keyword: 'Event dates: 12/01/2024, 13-02-24 in the calendar',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '12 1 24' } },
                        { match_phrase: { chunk_text: '12 1 2024' } },
                        { match_phrase: { chunk_text: '12 01 24' } },
                        { match_phrase: { chunk_text: '12 01 2024' } },
                        { match_phrase: { chunk_text: '13 2 24' } },
                        { match_phrase: { chunk_text: '13 2 2024' } },
                        { match_phrase: { chunk_text: '13 02 24' } },
                        { match_phrase: { chunk_text: '13 02 2024' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Event dates: , in the calendar',
                                    operator: 'or'
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should ignore invalid numeric dates and only match valid ones', () => {
        const params = {
            keyword: 'Dates: 50/04/92, 12/05/2024, 17/10/123',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '12 5 24' } },
                        { match_phrase: { chunk_text: '12 5 2024' } },
                        { match_phrase: { chunk_text: '12 05 24' } },
                        { match_phrase: { chunk_text: '12 05 2024' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: 50/04/92, , 17/10/123',
                                    operator: 'or'
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query for multiple adjacent numeric dates', () => {
        const params = {
            keyword: 'Dates:12/05/2024,13/05/2024,14/05/2024',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '12 5 24' } },
                        { match_phrase: { chunk_text: '12 5 2024' } },
                        { match_phrase: { chunk_text: '12 05 24' } },
                        { match_phrase: { chunk_text: '12 05 2024' } },
                        { match_phrase: { chunk_text: '13 5 24' } },
                        { match_phrase: { chunk_text: '13 5 2024' } },
                        { match_phrase: { chunk_text: '13 05 24' } },
                        { match_phrase: { chunk_text: '13 05 2024' } },
                        { match_phrase: { chunk_text: '14 5 24' } },
                        { match_phrase: { chunk_text: '14 5 2024' } },
                        { match_phrase: { chunk_text: '14 05 24' } },
                        { match_phrase: { chunk_text: '14 05 2024' } },
                        { match: { chunk_text: { query: 'Dates:,,', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query for numeric date at start and end of keyword', () => {
        const params = {
            keyword: '12/05/2024 project discussion 13/06/2024',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '12 5 24' } },
                        { match_phrase: { chunk_text: '12 5 2024' } },
                        { match_phrase: { chunk_text: '12 05 24' } },
                        { match_phrase: { chunk_text: '12 05 2024' } },
                        { match_phrase: { chunk_text: '13 6 24' } },
                        { match_phrase: { chunk_text: '13 6 2024' } },
                        { match_phrase: { chunk_text: '13 06 24' } },
                        { match_phrase: { chunk_text: '13 06 2024' } },
                        { match: { chunk_text: { query: 'project discussion', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query with only term if keyword is empty', () => {
        const params = {
            keyword: '',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }]
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query for multiple dates with different separators and whitespace', () => {
        const params = {
            keyword: 'Dates: 01/02/2024 03-04-24 07 / 08 / 2024 09 – 10 – 2024',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '1 2 24' } },
                        { match_phrase: { chunk_text: '1 2 2024' } },
                        { match_phrase: { chunk_text: '1 02 24' } },
                        { match_phrase: { chunk_text: '1 02 2024' } },
                        { match_phrase: { chunk_text: '01 2 24' } },
                        { match_phrase: { chunk_text: '01 2 2024' } },
                        { match_phrase: { chunk_text: '01 02 24' } },
                        { match_phrase: { chunk_text: '01 02 2024' } },
                        { match_phrase: { chunk_text: '3 4 24' } },
                        { match_phrase: { chunk_text: '3 4 2024' } },
                        { match_phrase: { chunk_text: '3 04 24' } },
                        { match_phrase: { chunk_text: '3 04 2024' } },
                        { match_phrase: { chunk_text: '03 4 24' } },
                        { match_phrase: { chunk_text: '03 4 2024' } },
                        { match_phrase: { chunk_text: '03 04 24' } },
                        { match_phrase: { chunk_text: '03 04 2024' } },
                        { match_phrase: { chunk_text: '7 8 24' } },
                        { match_phrase: { chunk_text: '7 8 2024' } },
                        { match_phrase: { chunk_text: '7 08 24' } },
                        { match_phrase: { chunk_text: '7 08 2024' } },
                        { match_phrase: { chunk_text: '07 8 24' } },
                        { match_phrase: { chunk_text: '07 8 2024' } },
                        { match_phrase: { chunk_text: '07 08 24' } },
                        { match_phrase: { chunk_text: '07 08 2024' } },
                        { match_phrase: { chunk_text: '9 10 24' } },
                        { match_phrase: { chunk_text: '9 10 2024' } },
                        { match_phrase: { chunk_text: '09 10 24' } },
                        { match_phrase: { chunk_text: '09 10 2024' } },
                        { match: { chunk_text: { query: 'Dates:', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query for multiple dates with different formats', () => {
        const params = {
            keyword:
                'Dates: 20/04/2022, through to the end of June 2022, with a review on 2022-07-15',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: '20 4 22' } },
                        { match_phrase: { chunk_text: '20 4 2022' } },
                        { match_phrase: { chunk_text: '20 04 22' } },
                        { match_phrase: { chunk_text: '20 04 2022' } },
                        { match_phrase: { chunk_text: 'Jun 22' } },
                        { match_phrase: { chunk_text: 'Jun 2022' } },
                        { match_phrase: { chunk_text: 'June 22' } },
                        { match_phrase: { chunk_text: 'June 2022' } },
                        { match_phrase: { chunk_text: '2022 7 15' } },
                        { match_phrase: { chunk_text: '2022 07 15' } },
                        { match_phrase: { chunk_text: '2022 Jul 15' } },
                        { match_phrase: { chunk_text: '2022 July 15' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: , through to the end of , with a review on',
                                    operator: 'or'
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should not extract numeric date without separators (concatenated)', () => {
        const params = {
            keyword: 'Event on 17102024 was successful',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        {
                            match: {
                                chunk_text: {
                                    query: 'Event on 17102024 was successful',
                                    operator: 'or'
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should build query for month-name day-month-year date pattern', () => {
        const params = {
            keyword: 'Meeting on 5 January 2024 at office',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.must[0].term.case_ref, '26-711111');
        assert.ok(
            Array.isArray(result.query.bool.should) &&
                result.query.bool.should.some((condition) =>
                    Object.hasOwn(condition, 'match_phrase')
                )
        );
    });
    it('Should build query for month-year date pattern', () => {
        const params = {
            keyword: 'Review scheduled in March 2024',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.must[0].term.case_ref, '26-711111');
        assert.ok(
            Array.isArray(result.query.bool.should) &&
                result.query.bool.should.some((condition) =>
                    Object.hasOwn(condition, 'match_phrase')
                )
        );
    });
    it('Should build query for year-month-day date pattern', () => {
        const params = {
            keyword: 'Event on 2024-05-12 at venue',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.must[0].term.case_ref, '26-711111');
        assert.ok(
            Array.isArray(result.query.bool.should) &&
                result.query.bool.should.some((condition) =>
                    Object.hasOwn(condition, 'match_phrase')
                )
        );
    });
    it('Should build query for ordinal day date pattern', () => {
        const params = {
            keyword: 'Hearing on 5th May 2024 at court',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.must[0].term.case_ref, '26-711111');
        assert.ok(
            Array.isArray(result.query.bool.should) &&
                result.query.bool.should.some((condition) =>
                    Object.hasOwn(condition, 'match_phrase')
                )
        );
    });
});
