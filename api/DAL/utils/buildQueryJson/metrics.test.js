import assert from 'node:assert';
import { describe, it } from 'node:test';
import { logQueryMetrics, SHOULD_THRESHOLD, VARIANT_THRESHOLD } from './metrics.js';

describe('metrics', () => {
    describe('Constants', () => {
        it('Should define VARIANT_THRESHOLD', () => {
            assert.strictEqual(typeof VARIANT_THRESHOLD, 'number');
            assert.strictEqual(VARIANT_THRESHOLD, 50);
        });

        it('Should define SHOULD_THRESHOLD', () => {
            assert.strictEqual(typeof SHOULD_THRESHOLD, 'number');
            assert.strictEqual(SHOULD_THRESHOLD, 50);
        });
    });

    describe('logQueryMetrics', () => {
        it('Should return early if logger is not provided', () => {
            // Should not throw, just return void
            const result = logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword: 'test',
                phrases: [],
                phrasesVariants: [],
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                caseReferenceNumber: '26-711111'
            });

            assert.strictEqual(result, undefined);
        });

        it('Should compute correct metrics with logger', () => {
            const logs = [];
            const mockLogger = {
                info: (meta, msg) => logs.push({ level: 'info', meta, msg }),
                warn: (meta, msg) => logs.push({ level: 'warn', meta, msg })
            };

            const queryJson = { query: { bool: { should: [] } }, size: 10 };
            const keyword = 'test keyword';

            logQueryMetrics({
                queryJson,
                keyword,
                phrases: ['test'],
                phrasesVariants: ['test variant'],
                shouldClauses: [{ match: { chunk_text: { query: 'test' } } }],
                buildMs: 15,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger,
                caseReferenceNumber: '26-711111'
            });

            assert.strictEqual(logs.length, 1);
            assert.strictEqual(logs[0].level, 'info');
            assert.strictEqual(logs[0].msg, '[QueryBuilder] Query metrics');
            assert.strictEqual(logs[0].meta.caseReferenceNumber, '26-711111');
            assert.strictEqual(typeof logs[0].meta.queryHash, 'string');
            assert.strictEqual(logs[0].meta.queryHash.length, 8); // 8 char SHA256 slice
            assert.strictEqual(logs[0].meta.phraseCount, 1);
            assert.strictEqual(logs[0].meta.phraseVariantCount, 1);
            assert.strictEqual(logs[0].meta.shouldClauseCount, 1);
            assert.strictEqual(logs[0].meta.payloadSize, JSON.stringify(queryJson).length);
            assert.strictEqual(logs[0].meta.buildMs, 15);
            assert.strictEqual(logs[0].meta.extractMs, 5);
            assert.strictEqual(logs[0].meta.variantMs, 3);
        });

        it('Should log warning when variant count exceeds threshold', () => {
            const logs = [];
            const mockLogger = {
                info: (meta, msg) => logs.push({ level: 'info', meta, msg }),
                warn: (meta, msg) => logs.push({ level: 'warn', meta, msg })
            };

            const phrasesVariants = Array(51).fill('variant'); // 51 variants > 50 threshold

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword: 'test',
                phrases: [],
                phrasesVariants: phrasesVariants,
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger,
                caseReferenceNumber: '26-711111'
            });

            assert.strictEqual(logs.length, 2);
            assert.strictEqual(logs[1].level, 'warn');
            assert.strictEqual(
                logs[1].msg,
                '[QueryBuilder] Variant/clause count exceeds safe threshold'
            );
            assert.strictEqual(logs[1].meta.variantCount, 51);
        });

        it('Should log warning when should clause count exceeds threshold', () => {
            const logs = [];
            const mockLogger = {
                info: (meta, msg) => logs.push({ level: 'info', meta, msg }),
                warn: (meta, msg) => logs.push({ level: 'warn', meta, msg })
            };

            const shouldClauses = Array(51).fill({ match: { chunk_text: { query: 'test' } } }); // 51 clauses

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword: 'test',
                phrases: [],
                phrasesVariants: [],
                shouldClauses: shouldClauses,
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger,
                caseReferenceNumber: '26-711111'
            });

            assert.strictEqual(logs.length, 2);
            assert.strictEqual(logs[1].level, 'warn');
            assert.strictEqual(
                logs[1].msg,
                '[QueryBuilder] Variant/clause count exceeds safe threshold'
            );
            assert.strictEqual(logs[1].meta.shouldClauseCount, 51);
        });

        it('Should compute consistent query hash for same keyword', () => {
            const logs1 = [];
            const logs2 = [];
            const mockLogger1 = {
                info: (meta) => logs1.push(meta),
                warn: () => {}
            };
            const mockLogger2 = {
                info: (meta) => logs2.push(meta),
                warn: () => {}
            };

            const keyword = 'consistent test keyword';

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword,
                phrases: [],
                phrasesVariants: [],
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger1,
                caseReferenceNumber: '26-711111'
            });

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword,
                phrases: [],
                phrasesVariants: [],
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger2,
                caseReferenceNumber: '26-711111'
            });

            assert.strictEqual(logs1[0].queryHash, logs2[0].queryHash);
        });

        it('Should compute different query hashes for different keywords', () => {
            const logs1 = [];
            const logs2 = [];
            const mockLogger1 = {
                info: (meta) => logs1.push(meta),
                warn: () => {}
            };
            const mockLogger2 = {
                info: (meta) => logs2.push(meta),
                warn: () => {}
            };

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword: 'keyword one',
                phrases: [],
                phrasesVariants: [],
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger1,
                caseReferenceNumber: '26-711111'
            });

            logQueryMetrics({
                queryJson: { query: { bool: {} } },
                keyword: 'keyword two',
                phrases: [],
                phrasesVariants: [],
                shouldClauses: [],
                buildMs: 10,
                extractMs: 5,
                variantMs: 3,
                logger: mockLogger2,
                caseReferenceNumber: '26-711111'
            });

            assert.notStrictEqual(logs1[0].queryHash, logs2[0].queryHash);
        });
    });
});
