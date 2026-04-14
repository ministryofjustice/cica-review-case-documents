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
                        { match_phrase: { chunk_text: '12 May 24' } },
                        { match_phrase: { chunk_text: '12 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 12' } },
                        { match_phrase: { chunk_text: '2024 05 12' } },
                        { match_phrase: { chunk_text: '2024 May 12' } },
                        {
                            match: {
                                chunk_text: { query: 'Meeting on at office' }
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
                    should: [{ match: { chunk_text: { query: 'Important meeting' } } }],
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
                        { match_phrase: { chunk_text: '12 Jan 24' } },
                        { match_phrase: { chunk_text: '12 Jan 2024' } },
                        { match_phrase: { chunk_text: '12 January 24' } },
                        { match_phrase: { chunk_text: '12 January 2024' } },
                        { match_phrase: { chunk_text: '2024 1 12' } },
                        { match_phrase: { chunk_text: '2024 01 12' } },
                        { match_phrase: { chunk_text: '2024 Jan 12' } },
                        { match_phrase: { chunk_text: '2024 January 12' } },
                        { match_phrase: { chunk_text: '13 2 24' } },
                        { match_phrase: { chunk_text: '13 2 2024' } },
                        { match_phrase: { chunk_text: '13 02 24' } },
                        { match_phrase: { chunk_text: '13 02 2024' } },
                        { match_phrase: { chunk_text: '13 Feb 24' } },
                        { match_phrase: { chunk_text: '13 Feb 2024' } },
                        { match_phrase: { chunk_text: '13 February 24' } },
                        { match_phrase: { chunk_text: '13 February 2024' } },
                        { match_phrase: { chunk_text: '2024 2 13' } },
                        { match_phrase: { chunk_text: '2024 02 13' } },
                        { match_phrase: { chunk_text: '2024 Feb 13' } },
                        { match_phrase: { chunk_text: '2024 February 13' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Event dates: , in the calendar'
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
                        { match_phrase: { chunk_text: '12 May 24' } },
                        { match_phrase: { chunk_text: '12 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 12' } },
                        { match_phrase: { chunk_text: '2024 05 12' } },
                        { match_phrase: { chunk_text: '2024 May 12' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: 50/04/92, , 17/10/123'
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
                        { match_phrase: { chunk_text: '12 May 24' } },
                        { match_phrase: { chunk_text: '12 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 12' } },
                        { match_phrase: { chunk_text: '2024 05 12' } },
                        { match_phrase: { chunk_text: '2024 May 12' } },
                        { match_phrase: { chunk_text: '13 5 24' } },
                        { match_phrase: { chunk_text: '13 5 2024' } },
                        { match_phrase: { chunk_text: '13 05 24' } },
                        { match_phrase: { chunk_text: '13 05 2024' } },
                        { match_phrase: { chunk_text: '13 May 24' } },
                        { match_phrase: { chunk_text: '13 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 13' } },
                        { match_phrase: { chunk_text: '2024 05 13' } },
                        { match_phrase: { chunk_text: '2024 May 13' } },
                        { match_phrase: { chunk_text: '14 5 24' } },
                        { match_phrase: { chunk_text: '14 5 2024' } },
                        { match_phrase: { chunk_text: '14 05 24' } },
                        { match_phrase: { chunk_text: '14 05 2024' } },
                        { match_phrase: { chunk_text: '14 May 24' } },
                        { match_phrase: { chunk_text: '14 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 14' } },
                        { match_phrase: { chunk_text: '2024 05 14' } },
                        { match_phrase: { chunk_text: '2024 May 14' } },
                        { match: { chunk_text: { query: 'Dates:,,' } } }
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
                        { match_phrase: { chunk_text: '12 May 24' } },
                        { match_phrase: { chunk_text: '12 May 2024' } },
                        { match_phrase: { chunk_text: '2024 5 12' } },
                        { match_phrase: { chunk_text: '2024 05 12' } },
                        { match_phrase: { chunk_text: '2024 May 12' } },
                        { match_phrase: { chunk_text: '13 6 24' } },
                        { match_phrase: { chunk_text: '13 6 2024' } },
                        { match_phrase: { chunk_text: '13 06 24' } },
                        { match_phrase: { chunk_text: '13 06 2024' } },
                        { match_phrase: { chunk_text: '13 Jun 24' } },
                        { match_phrase: { chunk_text: '13 Jun 2024' } },
                        { match_phrase: { chunk_text: '13 June 24' } },
                        { match_phrase: { chunk_text: '13 June 2024' } },
                        { match_phrase: { chunk_text: '2024 6 13' } },
                        { match_phrase: { chunk_text: '2024 06 13' } },
                        { match_phrase: { chunk_text: '2024 Jun 13' } },
                        { match_phrase: { chunk_text: '2024 June 13' } },
                        { match: { chunk_text: { query: 'project discussion' } } }
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

    it('Should build a hybrid query when search type is hybrid', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            searchType: 'hybrid'
        };

        const expected = {
            from: 5,
            size: 5,
            query: {
                bool: {
                    must: [{ term: { case_ref: '26-711111' } }],
                    should: [
                        {
                            match: {
                                chunk_text: {
                                    query: 'Important meeting',
                                    boost: 12
                                }
                            }
                        },
                        {
                            neural: {
                                embedding: {
                                    query_text: 'Important meeting',
                                    boost: 4
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        };

        const result = buildQueryJson(params);
        assert.equal(typeof result.min_score, 'number');
        assert.ok(result.min_score >= 0);
        assert.ok(result.min_score <= 1);

        const { min_score: _hybridMinScore, ...resultWithoutMinScore } = result;
        const hybridNeuralClause = resultWithoutMinScore.query.bool.should.find(
            (clause) => clause.neural?.embedding
        );
        const { k: hybridK, ...hybridEmbeddingWithoutK } = hybridNeuralClause.neural.embedding;
        assert.equal(typeof hybridK, 'number');
        assert.ok(hybridK > 0);
        hybridNeuralClause.neural.embedding = hybridEmbeddingWithoutK;
        assert.deepStrictEqual(resultWithoutMinScore, expected);
    });

    it('Should build a semantic query when search type is semantic', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            searchType: 'semantic'
        };

        const expected = {
            from: 5,
            size: 5,
            query: {
                neural: {
                    embedding: {
                        query_text: 'Important meeting',
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

        const { min_score: _semanticMinScore, ...resultWithoutMinScore } = result;
        const { k: semanticK, ...semanticEmbeddingWithoutK } =
            resultWithoutMinScore.query.neural.embedding;
        assert.equal(typeof semanticK, 'number');
        assert.ok(semanticK > 0);
        resultWithoutMinScore.query.neural.embedding = semanticEmbeddingWithoutK;
        assert.deepStrictEqual(resultWithoutMinScore, expected);
    });

    it('Should apply separate boosts for date and keyword clauses in hybrid mode', () => {
        const params = {
            keyword: 'brain injury september 2021',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 5,
            searchType: 'hybrid'
        };

        const result = buildQueryJson(params);
        const lexicalMust = result.query.bool.must;
        const hybridShould = result.query.bool.should;
        const dateBoolClause = hybridShould.find(
            (clause) => clause.bool && Array.isArray(clause.bool.should)
        );
        const keywordClause = hybridShould.find((clause) => clause.match?.chunk_text);
        const neuralClause = hybridShould.find((clause) => clause.neural?.embedding);

        assert.strictEqual(lexicalMust[0].term.case_ref, '26-711111');
        assert.strictEqual(result.query.bool.minimum_should_match, 1);
        assert.strictEqual(dateBoolClause.bool.boost, 1);
        assert.strictEqual(dateBoolClause.bool.minimum_should_match, 1);
        assert.strictEqual(keywordClause.match.chunk_text.boost, 12);
        assert.strictEqual(neuralClause.neural.embedding.boost, 4);
    });

    it('Should correctly compute hybrid pagination when page params are strings', () => {
        const result = buildQueryJson({
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: '2',
            itemsPerPage: '5',
            searchType: 'hybrid'
        });

        assert.strictEqual(result.from, 5);
        assert.strictEqual(result.size, 5);
        assert.strictEqual(result.query.bool.must[0].term.case_ref, '26-711111');
        assert.strictEqual(result.query.bool.minimum_should_match, 1);
    });

    it('Should not build semantic or hybrid query for an empty keyword even when type is semantic', () => {
        const params = {
            keyword: '',
            caseReferenceNumber: '26-711111',
            pageNumber: 1,
            itemsPerPage: 10,
            searchType: 'semantic'
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
                        { match_phrase: { chunk_text: '1 Feb 24' } },
                        { match_phrase: { chunk_text: '1 Feb 2024' } },
                        { match_phrase: { chunk_text: '1 February 24' } },
                        { match_phrase: { chunk_text: '1 February 2024' } },
                        { match_phrase: { chunk_text: '01 2 24' } },
                        { match_phrase: { chunk_text: '01 2 2024' } },
                        { match_phrase: { chunk_text: '01 02 24' } },
                        { match_phrase: { chunk_text: '01 02 2024' } },
                        { match_phrase: { chunk_text: '01 Feb 24' } },
                        { match_phrase: { chunk_text: '01 Feb 2024' } },
                        { match_phrase: { chunk_text: '01 February 24' } },
                        { match_phrase: { chunk_text: '01 February 2024' } },
                        { match_phrase: { chunk_text: '2024 2 1' } },
                        { match_phrase: { chunk_text: '2024 2 01' } },
                        { match_phrase: { chunk_text: '2024 02 1' } },
                        { match_phrase: { chunk_text: '2024 02 01' } },
                        { match_phrase: { chunk_text: '2024 Feb 1' } },
                        { match_phrase: { chunk_text: '2024 Feb 01' } },
                        { match_phrase: { chunk_text: '2024 February 1' } },
                        { match_phrase: { chunk_text: '2024 February 01' } },
                        { match_phrase: { chunk_text: '3 4 24' } },
                        { match_phrase: { chunk_text: '3 4 2024' } },
                        { match_phrase: { chunk_text: '3 04 24' } },
                        { match_phrase: { chunk_text: '3 04 2024' } },
                        { match_phrase: { chunk_text: '3 Apr 24' } },
                        { match_phrase: { chunk_text: '3 Apr 2024' } },
                        { match_phrase: { chunk_text: '3 April 24' } },
                        { match_phrase: { chunk_text: '3 April 2024' } },
                        { match_phrase: { chunk_text: '03 4 24' } },
                        { match_phrase: { chunk_text: '03 4 2024' } },
                        { match_phrase: { chunk_text: '03 04 24' } },
                        { match_phrase: { chunk_text: '03 04 2024' } },
                        { match_phrase: { chunk_text: '03 Apr 24' } },
                        { match_phrase: { chunk_text: '03 Apr 2024' } },
                        { match_phrase: { chunk_text: '03 April 24' } },
                        { match_phrase: { chunk_text: '03 April 2024' } },
                        { match_phrase: { chunk_text: '2024 4 3' } },
                        { match_phrase: { chunk_text: '2024 4 03' } },
                        { match_phrase: { chunk_text: '2024 04 3' } },
                        { match_phrase: { chunk_text: '2024 04 03' } },
                        { match_phrase: { chunk_text: '2024 Apr 3' } },
                        { match_phrase: { chunk_text: '2024 Apr 03' } },
                        { match_phrase: { chunk_text: '2024 April 3' } },
                        { match_phrase: { chunk_text: '2024 April 03' } },
                        { match_phrase: { chunk_text: '7 8 24' } },
                        { match_phrase: { chunk_text: '7 8 2024' } },
                        { match_phrase: { chunk_text: '7 08 24' } },
                        { match_phrase: { chunk_text: '7 08 2024' } },
                        { match_phrase: { chunk_text: '7 Aug 24' } },
                        { match_phrase: { chunk_text: '7 Aug 2024' } },
                        { match_phrase: { chunk_text: '7 August 24' } },
                        { match_phrase: { chunk_text: '7 August 2024' } },
                        { match_phrase: { chunk_text: '07 8 24' } },
                        { match_phrase: { chunk_text: '07 8 2024' } },
                        { match_phrase: { chunk_text: '07 08 24' } },
                        { match_phrase: { chunk_text: '07 08 2024' } },
                        { match_phrase: { chunk_text: '07 Aug 24' } },
                        { match_phrase: { chunk_text: '07 Aug 2024' } },
                        { match_phrase: { chunk_text: '07 August 24' } },
                        { match_phrase: { chunk_text: '07 August 2024' } },
                        { match_phrase: { chunk_text: '2024 8 7' } },
                        { match_phrase: { chunk_text: '2024 8 07' } },
                        { match_phrase: { chunk_text: '2024 08 7' } },
                        { match_phrase: { chunk_text: '2024 08 07' } },
                        { match_phrase: { chunk_text: '2024 Aug 7' } },
                        { match_phrase: { chunk_text: '2024 Aug 07' } },
                        { match_phrase: { chunk_text: '2024 August 7' } },
                        { match_phrase: { chunk_text: '2024 August 07' } },
                        { match_phrase: { chunk_text: '9 10 24' } },
                        { match_phrase: { chunk_text: '9 10 2024' } },
                        { match_phrase: { chunk_text: '9 Oct 24' } },
                        { match_phrase: { chunk_text: '9 Oct 2024' } },
                        { match_phrase: { chunk_text: '9 October 24' } },
                        { match_phrase: { chunk_text: '9 October 2024' } },
                        { match_phrase: { chunk_text: '09 10 24' } },
                        { match_phrase: { chunk_text: '09 10 2024' } },
                        { match_phrase: { chunk_text: '09 Oct 24' } },
                        { match_phrase: { chunk_text: '09 Oct 2024' } },
                        { match_phrase: { chunk_text: '09 October 24' } },
                        { match_phrase: { chunk_text: '09 October 2024' } },
                        { match_phrase: { chunk_text: '2024 10 9' } },
                        { match_phrase: { chunk_text: '2024 10 09' } },
                        { match_phrase: { chunk_text: '2024 Oct 9' } },
                        { match_phrase: { chunk_text: '2024 Oct 09' } },
                        { match_phrase: { chunk_text: '2024 October 9' } },
                        { match_phrase: { chunk_text: '2024 October 09' } },
                        { match: { chunk_text: { query: 'Dates:' } } }
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
                        { match_phrase: { chunk_text: '20 Apr 22' } },
                        { match_phrase: { chunk_text: '20 Apr 2022' } },
                        { match_phrase: { chunk_text: '20 April 22' } },
                        { match_phrase: { chunk_text: '20 April 2022' } },
                        { match_phrase: { chunk_text: '2022 4 20' } },
                        { match_phrase: { chunk_text: '2022 04 20' } },
                        { match_phrase: { chunk_text: '2022 Apr 20' } },
                        { match_phrase: { chunk_text: '2022 April 20' } },
                        { match_phrase: { chunk_text: 'Jun 22' } },
                        { match_phrase: { chunk_text: 'Jun 2022' } },
                        { match_phrase: { chunk_text: 'June 22' } },
                        { match_phrase: { chunk_text: 'June 2022' } },
                        { match_phrase: { chunk_text: '15 7 22' } },
                        { match_phrase: { chunk_text: '15 7 2022' } },
                        { match_phrase: { chunk_text: '15 07 22' } },
                        { match_phrase: { chunk_text: '15 07 2022' } },
                        { match_phrase: { chunk_text: '15 Jul 22' } },
                        { match_phrase: { chunk_text: '15 Jul 2022' } },
                        { match_phrase: { chunk_text: '15 July 22' } },
                        { match_phrase: { chunk_text: '15 July 2022' } },
                        { match_phrase: { chunk_text: '2022 7 15' } },
                        { match_phrase: { chunk_text: '2022 07 15' } },
                        { match_phrase: { chunk_text: '2022 Jul 15' } },
                        { match_phrase: { chunk_text: '2022 July 15' } },
                        {
                            match: {
                                chunk_text: {
                                    query: 'Dates: , through to the end of , with a review on'
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
                                    query: 'Event on 17102024 was successful'
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

    it('Should omit from and size for page chunk matches intent', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            queryIntent: 'pageChunkMatches'
        };

        const result = buildQueryJson(params);

        assert.strictEqual(Object.hasOwn(result, 'from'), false);
        assert.strictEqual(Object.hasOwn(result, 'size'), false);
        assert.deepStrictEqual(result.query.bool.must, [{ term: { case_ref: '26-711111' } }]);
    });

    it('Should omit from and size for semantic page chunk matches intent', () => {
        const params = {
            keyword: 'Important meeting',
            caseReferenceNumber: '26-711111',
            pageNumber: 2,
            itemsPerPage: 5,
            searchType: 'semantic',
            queryIntent: 'pageChunkMatches'
        };

        const result = buildQueryJson(params);

        assert.strictEqual(Object.hasOwn(result, 'from'), false);
        assert.strictEqual(Object.hasOwn(result, 'size'), false);
        assert.strictEqual(typeof result.query.neural.embedding.k, 'number');
        assert.ok(result.query.neural.embedding.k > 0);
    });
});
