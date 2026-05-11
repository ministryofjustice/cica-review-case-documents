import assert from 'node:assert';
import { describe, it } from 'node:test';
import { queryModeBuilders } from './modeBuilders.js';
import { SEARCH_TYPES } from './types.js';

describe('modeBuilders', () => {
    describe('queryModeBuilders', () => {
        it('Should have builders for all three search types', () => {
            assert.strictEqual(typeof queryModeBuilders[SEARCH_TYPES.KEYWORD], 'function');
            assert.strictEqual(typeof queryModeBuilders[SEARCH_TYPES.SEMANTIC], 'function');
            assert.strictEqual(typeof queryModeBuilders[SEARCH_TYPES.HYBRID], 'function');
        });

        describe('KEYWORD mode builder', () => {
            it('Should build keyword query with date extraction', () => {
                const result = queryModeBuilders[SEARCH_TYPES.KEYWORD]({
                    keyword: 'Meeting on 12/05/2024',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true
                });

                assert.strictEqual(typeof result.queryJson, 'object');
                assert.strictEqual(result.queryJson.query.bool.must[0].term.case_ref, '26-711111');
                assert.ok(Array.isArray(result.queryJson.query.bool.should));
                assert.ok(result.queryJson.query.bool.should.length > 0);
                assert.strictEqual(typeof result.phrases, 'object'); // array
                assert.strictEqual(typeof result.phrasesVariants, 'object'); // array
                assert.strictEqual(typeof result.shouldClauses, 'object'); // array
                assert.strictEqual(typeof result.extractMs, 'number');
                assert.strictEqual(typeof result.variantMs, 'number');
            });

            it('Should include document scoping when documentId provided', () => {
                const result = queryModeBuilders[SEARCH_TYPES.KEYWORD]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 5,
                    documentId: 'doc-uuid-123',
                    enableDateExtraction: true
                });

                const must = result.queryJson.query.bool.must;
                assert.ok(must.some((clause) => clause.term?.source_doc_id === 'doc-uuid-123'));
                assert.ok(must.some((clause) => clause.term?.page_number === 5));
            });

            it('Should skip date extraction when enableDateExtraction is false', () => {
                const result = queryModeBuilders[SEARCH_TYPES.KEYWORD]({
                    keyword: 'Meeting on 12/05/2024',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: false
                });

                assert.strictEqual(result.phrases.length, 0);
                assert.strictEqual(result.phrasesVariants.length, 0);
                assert.strictEqual(result.extractMs, 0);
                assert.strictEqual(result.variantMs, 0);
            });
        });

        describe('SEMANTIC mode builder', () => {
            it('Should build semantic query without date extraction', () => {
                const result = queryModeBuilders[SEARCH_TYPES.SEMANTIC]({
                    keyword: 'Important meeting',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1
                });

                assert.strictEqual(typeof result.queryJson, 'object');
                assert.ok(result.queryJson.query.neural?.embedding);
                assert.strictEqual(
                    result.queryJson.query.neural.embedding.query_text,
                    'Important meeting'
                );

                // Semantic mode always returns zero metrics
                assert.strictEqual(result.phrases.length, 0);
                assert.strictEqual(result.phrasesVariants.length, 0);
                assert.strictEqual(result.shouldClauses.length, 0);
                assert.strictEqual(result.extractMs, 0);
                assert.strictEqual(result.variantMs, 0);
            });

            it('Should include document scoping in semantic query', () => {
                const result = queryModeBuilders[SEARCH_TYPES.SEMANTIC]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 5,
                    documentId: 'doc-uuid-123'
                });

                const filter = result.queryJson.query.neural.embedding.filter;
                assert.ok(
                    filter.bool?.must.some(
                        (clause) => clause.term?.source_doc_id === 'doc-uuid-123'
                    )
                );
                assert.ok(filter.bool?.must.some((clause) => clause.term?.page_number === 5));
            });

            it('Should simplify filter DSL when only case_ref filter remains', () => {
                const result = queryModeBuilders[SEARCH_TYPES.SEMANTIC]({
                    keyword: 'test keyword',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1
                });

                // Filter should be simplified to just the case_ref term
                const filter = result.queryJson.query.neural.embedding.filter;
                assert.strictEqual(filter.term?.case_ref, '26-711111');
                assert.strictEqual(Object.hasOwn(filter, 'bool'), false);
            });

            it('Should promote filter to top-level when keyword is empty', () => {
                const result = queryModeBuilders[SEARCH_TYPES.SEMANTIC]({
                    keyword: '',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1
                });

                // When keyword is empty, the query should be just a filter
                assert.strictEqual(Object.hasOwn(result.queryJson.query, 'neural'), false);
                assert.strictEqual(Object.hasOwn(result.queryJson, 'min_score'), false);
                assert.ok(result.queryJson.query.bool?.must[0].term?.case_ref);
            });
        });

        describe('HYBRID mode builder', () => {
            it('Should build hybrid query with date extraction', () => {
                const result = queryModeBuilders[SEARCH_TYPES.HYBRID]({
                    keyword: 'Meeting on 12/05/2024',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true,
                    keywordBoost: 12,
                    dateBoost: 1,
                    semanticBoost: 4
                });

                assert.strictEqual(typeof result.queryJson, 'object');
                assert.ok(result.queryJson.query.bool);
                assert.ok(Array.isArray(result.queryJson.query.bool.should));
                assert.ok(result.queryJson.query.bool.should.length > 0);

                // Should have lexical, date, and neural clauses
                const hasLexical = result.queryJson.query.bool.should.some(
                    (clause) => clause.match?.chunk_text
                );
                const hasDate = result.queryJson.query.bool.should.some(
                    (clause) => clause.bool?.should
                );
                const hasNeural = result.queryJson.query.bool.should.some(
                    (clause) => clause.neural?.embedding
                );

                assert.ok(hasLexical);
                assert.ok(hasDate);
                assert.ok(hasNeural);
            });

            it('Should apply correct boost factors', () => {
                const result = queryModeBuilders[SEARCH_TYPES.HYBRID]({
                    keyword: 'test keyword 12/05/2024',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true,
                    keywordBoost: 20,
                    dateBoost: 5,
                    semanticBoost: 10
                });

                const should = result.queryJson.query.bool.should;
                const lexical = should.find((c) => c.match?.chunk_text);
                const dateClause = should.find((c) => c.bool?.should);
                const neural = should.find((c) => c.neural?.embedding);

                assert.ok(lexical, 'lexical clause should exist');
                assert.ok(dateClause, 'dateClause should exist');
                assert.ok(neural, 'neural clause should exist');
                assert.strictEqual(lexical.match.chunk_text.boost, 20);
                assert.strictEqual(dateClause.bool.boost, 5);
                assert.strictEqual(neural.neural.embedding.boost, 10);
            });

            it('Should include document scoping in hybrid query', () => {
                const result = queryModeBuilders[SEARCH_TYPES.HYBRID]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 5,
                    documentId: 'doc-uuid-123',
                    enableDateExtraction: true,
                    keywordBoost: 12,
                    dateBoost: 1,
                    semanticBoost: 4
                });

                const must = result.queryJson.query.bool.must;
                assert.ok(must.some((clause) => clause.term?.source_doc_id === 'doc-uuid-123'));
                assert.ok(must.some((clause) => clause.term?.page_number === 5));
            });

            it('Should omit neural clause when keyword is empty', () => {
                const result = queryModeBuilders[SEARCH_TYPES.HYBRID]({
                    keyword: '',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true,
                    keywordBoost: 12,
                    dateBoost: 1,
                    semanticBoost: 4
                });

                const hasNeural = result.queryJson.query.bool.should.some(
                    (clause) => clause.neural?.embedding
                );
                assert.strictEqual(hasNeural, false);
            });
        });

        describe('Builder output shape', () => {
            it('Should return consistent shape for all modes', () => {
                const keywordResult = queryModeBuilders[SEARCH_TYPES.KEYWORD]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true
                });

                const semanticResult = queryModeBuilders[SEARCH_TYPES.SEMANTIC]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1
                });

                const hybridResult = queryModeBuilders[SEARCH_TYPES.HYBRID]({
                    keyword: 'test',
                    caseReferenceNumber: '26-711111',
                    safePageNumber: 1,
                    enableDateExtraction: true,
                    keywordBoost: 12,
                    dateBoost: 1,
                    semanticBoost: 4
                });

                // All should have same keys
                const expectedKeys = [
                    'queryJson',
                    'phrases',
                    'phrasesVariants',
                    'shouldClauses',
                    'extractMs',
                    'variantMs'
                ];
                assert.deepStrictEqual(Object.keys(keywordResult).sort(), expectedKeys.sort());
                assert.deepStrictEqual(Object.keys(semanticResult).sort(), expectedKeys.sort());
                assert.deepStrictEqual(Object.keys(hybridResult).sort(), expectedKeys.sort());
            });
        });
    });
});
