import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES from '../../../search/constants/searchTypes.js';
import buildQueryJson from './index.js';
import {
    buildDateAwareShouldClauses,
    buildSemanticQuery,
    createQueryTypeBuilders
} from './queryTypeBuilders.js';

describe('buildQueryJson', () => {
    it('Should build query with match_phrase for a single valid numeric date', () => {
        const params = {
            keyword: 'Meeting on 12/05/2024 at office',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 10,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '12 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 12', _name: 'dates' } } },
                        {
                            match: {
                                chunk_text: { query: 'Meeting on at office', _name: 'keyword' }
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
            itemsPerPage: 5,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 5,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match: { chunk_text: { query: 'Important meeting', _name: 'keyword' } } }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should omit named query metadata by default', () => {
        const result = buildQueryJson({
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5,
            options: { searchType: 'keyword-dates' }
        });

        const clauses = result.query.bool.should || [];
        for (const clause of clauses) {
            if (clause.match?.chunk_text) {
                assert.strictEqual(clause.match.chunk_text._name, undefined);
            }
            if (clause.match_phrase?.chunk_text) {
                assert.strictEqual(clause.match_phrase.chunk_text._name, undefined);
            }
        }
    });

    it('Should build query with multiple numeric dates and remaining text', () => {
        const params = {
            keyword: 'Event dates: 12/01/2024, 13-02-24 in the calendar',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '12 1 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 1 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 01 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 01 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 Jan 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 Jan 2024', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '12 January 24', _name: 'dates' } }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '12 January 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '2024 1 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 01 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Jan 12', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 January 12', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '13 2 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 2 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 02 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 02 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 Feb 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 Feb 2024', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '13 February 24', _name: 'dates' }
                            }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '13 February 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '2024 2 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 02 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Feb 13', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 February 13', _name: 'dates' }
                            }
                        },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Event dates: , in the calendar',
                                    _name: 'keyword'
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '12 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 12', _name: 'dates' } } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: 50/04/92, , 17/10/123',
                                    _name: 'keyword'
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '12 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '14 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 14', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 14', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 14', _name: 'dates' } } },
                        { match: { chunk_text: { query: 'Dates:,,', _name: 'keyword' } } }
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '12 5 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 5 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 05 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 5 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 05 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 May 12', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 6 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 6 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 06 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 06 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 Jun 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 Jun 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 June 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '13 June 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 6 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 06 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Jun 13', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 June 13', _name: 'dates' } } },
                        { match: { chunk_text: { query: 'project discussion', _name: 'keyword' } } }
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }]
                }
            }
        };

        const result = buildQueryJson(params);
        assert.deepStrictEqual(result, expected);
    });

    it('Should suppress date extraction when using keyword only mode', () => {
        // Keyword contains a date but should produce a plain match clause
        // with no match_phrase clauses, confirming the flag is respected.
        const params = {
            keyword: 'Meeting on 12/05/2024 at office',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: 'keyword', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        {
                            match: {
                                chunk_text: {
                                    query: 'Meeting on 12/05/2024 at office',
                                    _name: 'keyword'
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
        assert.ok(
            !result.query.bool.should.some((c) => c.match_phrase),
            'No match_phrase clauses should be present when date extraction is disabled'
        );
    });

    it('Should throw when an invalid searchType is provided', () => {
        assert.throws(
            () =>
                buildQueryJson({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    pageNumber: 1,
                    itemsPerPage: 10,
                    options: { searchType: 'invalid', includeNamedQueries: true }
                }),
            {
                message:
                    'Invalid searchType "invalid". Must be one of: hybrid-dates, keyword-dates, hybrid, keyword, semantic'
            }
        );
    });

    it('Should build a hybrid query when searchType is hybrid', () => {
        // Test owns its tuning via explicit overrides so it is decoupled from
        // production defaults in DEFAULT_QUERY_DSL_CONFIG.
        const testQueryDslConfig = {
            semanticMinScore: 0.5,
            semanticK: 50,
            lexicalBoost: 20,
            dateBoost: 1,
            neuralBoost: 4
        };
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            options: {
                searchType: 'hybrid',
                includeNamedQueries: true,
                queryDslConfig: testQueryDslConfig
            }
        };

        const expected = {
            from: 5,
            size: 5,
            min_score: 0.5,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        {
                            match: {
                                chunk_text: {
                                    query: 'Important meeting',
                                    boost: 20,
                                    _name: 'keyword'
                                }
                            }
                        },
                        {
                            neural: {
                                embedding: {
                                    query_text: 'Important meeting',
                                    k: 50,
                                    filter: { term: { case_ref: '26-711111' } },
                                    boost: 4,
                                    _name: 'semantic'
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

    it('Should build a semantic query when searchType is semantic', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            options: {
                searchType: 'semantic',
                includeNamedQueries: true,
                queryDslConfig: {
                    // Pure semantic mode uses semanticOnlyMinScore (cosine 0..1).
                    semanticOnlyMinScore: 0.5,
                    semanticK: 50,
                    lexicalBoost: 20,
                    dateBoost: 1,
                    neuralBoost: 4
                }
            }
        };

        const expected = {
            from: 5,
            size: 5,
            min_score: 0.5,
            query: {
                neural: {
                    embedding: {
                        query_text: 'Important meeting',
                        k: 50,
                        filter: {
                            term: {
                                case_ref: '26-711111'
                            }
                        }
                    }
                }
            }
        };

        const result = buildQueryJson(params);
        assert.equal(typeof result.min_score, 'number');
        assert.ok(result.min_score >= 0);
        assert.ok(result.min_score <= 1);

        // Builder adds named query metadata to the neural clause.
        expected.query.neural.embedding._name = 'semantic';
        assert.deepStrictEqual(result, expected);
    });

    it('Should apply separate boosts for date and keyword clauses in hybrid mode', () => {
        // Test owns its tuning via explicit overrides so assertions don't depend
        // on production tuning in DEFAULT_QUERY_DSL_CONFIG.
        const testQueryDslConfig = {
            semanticMinScore: 0.5,
            semanticK: 50,
            lexicalBoost: 17,
            dateBoost: 3,
            neuralBoost: 11
        };
        const params = {
            keyword: 'brain injury september 2021',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5,
            options: {
                searchType: 'hybrid-dates',
                includeNamedQueries: true,
                queryDslConfig: testQueryDslConfig
            }
        };

        const result = buildQueryJson(params);
        const hybridShould = result.query.bool.should;
        const dateBoolClause = hybridShould.find(
            (clause) => clause.bool && Array.isArray(clause.bool.should)
        );
        const keywordClause = hybridShould.find((clause) => clause.match?.chunk_text);
        const neuralClause = hybridShould.find((clause) => clause.neural?.embedding);

        const lexicalFilter = result.query.bool.filter;
        assert.ok(Array.isArray(lexicalFilter) && lexicalFilter[0]?.term?.case_ref === '26-711111');
        assert.strictEqual(result.query.bool.minimum_should_match, 1);
        assert.strictEqual(dateBoolClause.bool.boost, 3);
        assert.strictEqual(dateBoolClause.bool.minimum_should_match, 1);
        assert.strictEqual(keywordClause.match.chunk_text.boost, 17);
        assert.strictEqual(neuralClause.neural.embedding.boost, 11);
    });

    it('Should correctly compute hybrid pagination when page params are strings', () => {
        const result = buildQueryJson({
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: '2',
            itemsPerPage: '5',
            options: { searchType: 'hybrid', includeNamedQueries: true }
        });

        assert.strictEqual(result.from, 5);
        assert.strictEqual(result.size, 5);
        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
        assert.strictEqual(result.query.bool.minimum_should_match, 1);
    });

    it('Should not build semantic or hybrid query for an empty keyword', () => {
        const params = {
            keyword: '',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: 'semantic', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                term: {
                    case_ref: '26-711111'
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '1 2 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '1 2 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '1 02 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '1 02 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '1 Feb 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '1 Feb 2024', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '1 February 24', _name: 'dates' } }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '1 February 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '01 2 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '01 2 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '01 02 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '01 02 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '01 Feb 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '01 Feb 2024', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '01 February 24', _name: 'dates' }
                            }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '01 February 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '2024 2 1', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 2 01', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 02 1', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 02 01', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Feb 1', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Feb 01', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 February 1', _name: 'dates' }
                            }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 February 01', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '3 4 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 4 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 04 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 04 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 Apr 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 Apr 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 April 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '3 April 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 4 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 4 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 04 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 04 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 Apr 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 Apr 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '03 April 24', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '03 April 2024', _name: 'dates' } }
                        },
                        { match_phrase: { chunk_text: { query: '2024 4 3', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 4 03', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 04 3', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 04 03', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Apr 3', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Apr 03', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 April 3', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '2024 April 03', _name: 'dates' } }
                        },
                        { match_phrase: { chunk_text: { query: '7 8 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 8 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 08 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 08 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 Aug 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 Aug 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '7 August 24', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '7 August 2024', _name: 'dates' } }
                        },
                        { match_phrase: { chunk_text: { query: '07 8 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 8 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 08 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 08 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 Aug 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 Aug 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '07 August 24', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '07 August 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '2024 8 7', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 8 07', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 08 7', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 08 07', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Aug 7', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Aug 07', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '2024 August 7', _name: 'dates' } }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 August 07', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '9 10 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '9 10 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '9 Oct 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '9 Oct 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '9 October 24', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '9 October 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '09 10 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '09 10 2024', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '09 Oct 24', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '09 Oct 2024', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '09 October 24', _name: 'dates' } }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '09 October 2024', _name: 'dates' }
                            }
                        },
                        { match_phrase: { chunk_text: { query: '2024 10 9', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 10 09', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Oct 9', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2024 Oct 09', _name: 'dates' } } },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 October 9', _name: 'dates' }
                            }
                        },
                        {
                            match_phrase: {
                                chunk_text: { query: '2024 October 09', _name: 'dates' }
                            }
                        },
                        { match: { chunk_text: { query: 'Dates:', _name: 'keyword' } } }
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        { match_phrase: { chunk_text: { query: '20 4 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 4 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 04 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 04 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 Apr 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 Apr 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '20 April 22', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '20 April 2022', _name: 'dates' } }
                        },
                        { match_phrase: { chunk_text: { query: '2022 4 20', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 04 20', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 Apr 20', _name: 'dates' } } },
                        {
                            match_phrase: { chunk_text: { query: '2022 April 20', _name: 'dates' } }
                        },
                        { match_phrase: { chunk_text: { query: 'Jun 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: 'Jun 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: 'June 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: 'June 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 7 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 7 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 07 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 07 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 Jul 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 Jul 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 July 22', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '15 July 2022', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 7 15', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 07 15', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 Jul 15', _name: 'dates' } } },
                        { match_phrase: { chunk_text: { query: '2022 July 15', _name: 'dates' } } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: , through to the end of , with a review on',
                                    _name: 'keyword'
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        {
                            match: {
                                chunk_text: {
                                    query: 'Event on 17102024 was successful',
                                    _name: 'keyword'
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
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
            itemsPerPage: 10,
            options: { searchType: 'keyword-dates', includeNamedQueries: true }
        };
        const result = buildQueryJson(params);
        assert.strictEqual(result.from, 0);
        assert.strictEqual(result.size, 10);
        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
        assert.ok(
            Array.isArray(result.query.bool.should) &&
                result.query.bool.should.some((condition) =>
                    Object.hasOwn(condition, 'match_phrase')
                )
        );
    });

    it('Should omit from and size for page chunk matches intent', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            options: { includePagination: false }
        };

        const result = buildQueryJson(params);

        assert.strictEqual(Object.hasOwn(result, 'from'), false);
        assert.strictEqual(Object.hasOwn(result, 'size'), false);
        assert.deepStrictEqual(result.query.bool.filter, [{ term: { case_ref: '26-711111' } }]);
    });

    it('Should omit from and size for semantic page chunk matches intent', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            options: { searchType: 'semantic', includeNamedQueries: true, includePagination: false }
        };

        const result = buildQueryJson(params);

        assert.strictEqual(Object.hasOwn(result, 'from'), false);
        assert.strictEqual(Object.hasOwn(result, 'size'), false);
        assert.strictEqual(typeof result.query.neural.embedding.k, 'number');
        assert.ok(result.query.neural.embedding.k > 0);
    });

    it('Should apply queryDslConfig overrides for min score, k and default boosts', () => {
        // Use a simple first-page request and verify the configured semanticK
        // override is passed through unchanged in the built query.
        const result = buildQueryJson({
            keyword: 'acute 28/11/2022',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5,
            options: {
                searchType: 'hybrid-dates',
                includeNamedQueries: true,
                queryDslConfig: {
                    semanticMinScore: 0.91,
                    semanticK: 7,
                    lexicalBoost: 31,
                    dateBoost: 2,
                    neuralBoost: 9
                }
            }
        });

        const shouldClauses = result.query.bool.should;
        const keywordClause = shouldClauses.find((clause) => clause.match?.chunk_text);
        const dateClause = shouldClauses.find((clause) => clause.bool?.should);
        const neuralClause = shouldClauses.find((clause) => clause.neural?.embedding);

        assert.strictEqual(result.min_score, 0.91);
        assert.strictEqual(keywordClause.match.chunk_text.boost, 31);
        assert.strictEqual(dateClause.bool.boost, 2);
        assert.strictEqual(neuralClause.neural.embedding.boost, 9);
        assert.strictEqual(neuralClause.neural.embedding.k, 7);
    });

    it('Should log queryTypeBuilder parameters and output when logger is provided', () => {
        const originalPrettyFlag = process.env.APP_LOG_PRETTY_JSON;
        const debugCalls = [];
        const infoCalls = [];
        const warnCalls = [];
        const logger = {
            debug(...args) {
                debugCalls.push(args);
            },
            info(...args) {
                infoCalls.push(args);
            },
            warn(...args) {
                warnCalls.push(args);
            }
        };

        process.env.APP_LOG_PRETTY_JSON = 'true';

        const result = buildQueryJson({
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5,
            options: {
                logger,
                searchType: 'keyword'
            }
        });

        if (originalPrettyFlag === undefined) {
            delete process.env.APP_LOG_PRETTY_JSON;
        } else {
            process.env.APP_LOG_PRETTY_JSON = originalPrettyFlag;
        }

        assert.strictEqual(result.query.bool.filter[0].term.case_ref, '26-711111');
        assert.ok(debugCalls.length >= 5);
        assert.strictEqual(infoCalls.length, 0);
        assert.strictEqual(warnCalls.length, 0);

        const debugMessages = debugCalls.map((call) => call[1]).filter(Boolean);

        assert.ok(debugMessages.some((message) => message.includes('Built query JSON')));
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[BuildQueryJson] keyword queryTypeBuilder parameters')
            )
        );
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[BuildQueryJson] keyword queryTypeBuilder output')
            )
        );
    });

    it('Should fallback to original extracted phrase when no date variants are produced', () => {
        const result = buildDateAwareShouldClauses({
            keyword: '31/02/2024',
            enableDateExtraction: true,
            includeNamedQueries: true
        });

        assert.deepStrictEqual(result.phrases, ['31/02/2024']);
        assert.deepStrictEqual(result.phrasesVariants, ['31/02/2024']);
        assert.deepStrictEqual(result.shouldClauses, [
            { match_phrase: { chunk_text: { query: '31/02/2024', _name: 'dates' } } }
        ]);
    });

    it('Should append document filters in keyword query builder when documentId is provided', () => {
        const queryTypeBuilders = createQueryTypeBuilders();
        const result = queryTypeBuilders[SEARCH_TYPES.KEYWORD]({
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            safePageNumber: 3,
            documentId: 'a-doc-id'
        });

        assert.deepStrictEqual(result.queryJson.query.bool.filter, [
            { term: { case_ref: '26-711111' } },
            { term: { source_doc_id: 'a-doc-id' } },
            { term: { page_number: 3 } }
        ]);
    });

    it('Should execute logger debug branches for all query type builders', () => {
        const debugCalls = [];
        const logger = {
            debug(...args) {
                debugCalls.push(args);
            }
        };
        const queryTypeBuilders = createQueryTypeBuilders();

        queryTypeBuilders[SEARCH_TYPES.KEYWORD]({
            keyword: 'keyword mode',
            caseReferenceNumber: '26-711111',
            safePageNumber: 1,
            logger
        });
        queryTypeBuilders[SEARCH_TYPES.KEYWORD_DATES]({
            keyword: 'keyword-dates 12/05/2024',
            caseReferenceNumber: '26-711111',
            safePageNumber: 1,
            logger
        });
        queryTypeBuilders[SEARCH_TYPES.SEMANTIC]({
            keyword: 'semantic mode',
            caseReferenceNumber: '26-711111',
            safePageNumber: 1,
            logger
        });
        queryTypeBuilders[SEARCH_TYPES.HYBRID]({
            keyword: 'hybrid mode',
            caseReferenceNumber: '26-711111',
            safePageNumber: 1,
            logger
        });
        queryTypeBuilders[SEARCH_TYPES.HYBRID_DATES]({
            keyword: 'hybrid-dates 12/05/2024',
            caseReferenceNumber: '26-711111',
            safePageNumber: 1,
            logger
        });

        const debugMessages = debugCalls.map((call) => call[1]).filter(Boolean);

        assert.ok(
            debugMessages.some((message) =>
                message.includes('[QueryTypeBuilder] Building keyword query')
            )
        );
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[QueryTypeBuilder] Building keyword-dates query')
            )
        );
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[QueryTypeBuilder] Building semantic query')
            )
        );
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[QueryTypeBuilder] Building hybrid query')
            )
        );
        assert.ok(
            debugMessages.some((message) =>
                message.includes('[QueryTypeBuilder] Building hybrid-dates query')
            )
        );
    });

    it('Should build semantic bool query with date match clauses and document scoping', () => {
        const result = buildSemanticQuery({
            keyword: 'injury on 12/05/2024',
            caseReferenceNumber: '26-711111',
            safePageNumber: 4,
            documentId: 'doc-123',
            includeNamedQueries: true,
            matchPhraseClauses: [
                { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } }
            ],
            queryDslConfig: {
                semanticK: 9,
                semanticMinScore: 0.77
            }
        });

        assert.strictEqual(result.min_score, 0.77);
        assert.deepStrictEqual(result.query.bool.filter, [
            { term: { case_ref: '26-711111' } },
            { term: { source_doc_id: 'doc-123' } },
            { term: { page_number: 4 } }
        ]);
        assert.deepStrictEqual(result.query.bool.should[0], {
            bool: {
                _name: 'dates',
                should: [
                    { match_phrase: { chunk_text: { query: '12 May 2024', _name: 'dates' } } }
                ],
                minimum_should_match: 1
            }
        });
        assert.deepStrictEqual(result.query.bool.should[1], {
            neural: {
                embedding: {
                    query_text: 'injury on 12/05/2024',
                    k: 9,
                    filter: {
                        bool: {
                            filter: [
                                { term: { case_ref: '26-711111' } },
                                { term: { source_doc_id: 'doc-123' } },
                                { term: { page_number: 4 } }
                            ]
                        }
                    },
                    _name: 'semantic'
                }
            }
        });
    });

    it('Should build pure semantic query with document-scoped neural filter', () => {
        const result = buildSemanticQuery({
            keyword: 'injury details',
            caseReferenceNumber: '26-711111',
            safePageNumber: 2,
            documentId: 'doc-456',
            queryDslConfig: {
                semanticK: 11,
                // Pure neural mode uses semanticOnlyMinScore (cosine 0..1 range),
                // not semanticMinScore (which is for combined hybrid scores).
                semanticOnlyMinScore: 0.66
            }
        });

        assert.strictEqual(result.min_score, 0.66);
        assert.deepStrictEqual(result.query.neural.embedding.filter, {
            bool: {
                filter: [
                    { term: { case_ref: '26-711111' } },
                    { term: { source_doc_id: 'doc-456' } },
                    { term: { page_number: 2 } }
                ]
            }
        });
    });

    it('Should append document filters in hybrid query builder when documentId is provided', () => {
        const result = buildQueryJson({
            keyword: 'important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: {
                searchType: SEARCH_TYPES.HYBRID,
                includeNamedQueries: true,
                documentId: 'doc-789'
            }
        });

        assert.deepStrictEqual(result.query.bool.filter, [
            { term: { case_ref: '26-711111' } },
            { term: { source_doc_id: 'doc-789' } },
            { term: { page_number: 1 } }
        ]);
    });

    it('Should fall back to defaults when queryDslConfig contains undefined values', () => {
        // When overrides contain undefined values, they should not replace defaults.
        // This ensures partial config objects like { semanticK: undefined } don't break queries.
        const baseline = buildQueryJson({
            keyword: 'test search',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: SEARCH_TYPES.SEMANTIC, includeNamedQueries: true }
        });

        const result = buildQueryJson({
            keyword: 'test search',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: {
                searchType: SEARCH_TYPES.SEMANTIC,
                includeNamedQueries: true,
                queryDslConfig: {
                    semanticK: undefined,
                    semanticMinScore: undefined
                    // other fields omitted to test partial override
                }
            }
        });

        // Undefined overrides should behave exactly like no overrides.
        assert.strictEqual(result.query.neural.embedding.k, baseline.query.neural.embedding.k);
        assert.strictEqual(result.min_score, baseline.min_score);
    });

    it('Should remove min_score from hybrid query when keyword is empty with no date phrases', () => {
        // When keyword is empty and there are no date phrases, the hybrid query has
        // no scoring clauses (only filter clauses). min_score must be removed to
        // prevent filtering out all results from a filter-only query.
        const result = buildQueryJson({
            keyword: '',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: SEARCH_TYPES.HYBRID, includeNamedQueries: true }
        });

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }]
                }
            }
        };

        // min_score should be removed (undefined)
        assert.strictEqual(result.min_score, undefined);
        assert.deepStrictEqual(result, expected);
    });

    it('Should remove min_score from hybrid-dates query when keyword is empty with no date phrases', () => {
        // Even with hybrid-dates searchType, when keyword is empty and date extraction
        // finds no dates, the result is filter-only. min_score must be removed.
        const result = buildQueryJson({
            keyword: '',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: SEARCH_TYPES.HYBRID_DATES, includeNamedQueries: true }
        });

        const expected = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    filter: [{ term: { case_ref: '26-711111' } }]
                }
            }
        };

        // min_score should be removed (undefined)
        assert.strictEqual(result.min_score, undefined);
        assert.deepStrictEqual(result, expected);
    });

    it('Should keep min_score in hybrid query when there are scoring clauses despite empty keyword', () => {
        // If date phrases are extracted (keyword is not truly empty in content),
        // min_score should be kept since there are scoring clauses.
        const result = buildQueryJson({
            keyword: '12/05/2024',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            options: { searchType: SEARCH_TYPES.HYBRID_DATES, includeNamedQueries: true }
        });

        // min_score should be present since there are date phrase clauses
        assert.strictEqual(typeof result.min_score, 'number');
        assert.ok(result.min_score > 0);
        // Should have date phrase scoring clauses
        assert.ok(
            result.query.bool.should.some((clause) =>
                clause.bool?.should?.some((c) => c.match_phrase)
            )
        );
    });
});
