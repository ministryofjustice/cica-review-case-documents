import assert from 'node:assert';
import { describe, it } from 'node:test';
import buildQueryJson from './index.js';

describe('buildQueryJson', () => {
    it('should build query with term and match_phrase for a single date', () => {
        const params = {
            keyword: 'Meeting on 12 Jan 2024 at office',
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
                        { match_phrase: { chunk_text: '12 Jan 2024' } },
                        { match: { chunk_text: { query: 'Meeting on at office', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('should build query with only match for keyword with no dates', () => {
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
    it('should build query with match_phrase for dates and match for remaining text', () => {
        const params = {
            keyword: 'Feb 2023 and March-2024 events',
            caseReferenceNumber: '26-711111',
            pageNumber: 3,
            itemsPerPage: 20
        };

        const expected = {
            from: 40,
            size: 20,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: 'Feb 2023' } },
                        { match_phrase: { chunk_text: 'March-2024' } },
                        { match: { chunk_text: { query: 'and events', operator: 'or' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('should build query with only term if keyword is empty', () => {
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
    it('should extract concatenated numeric date like "17102024"', () => {
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
                        { match_phrase: { chunk_text: '17102024' } },
                        {
                            match: {
                                chunk_text: { query: 'Event on was successful', operator: 'or' }
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
});
