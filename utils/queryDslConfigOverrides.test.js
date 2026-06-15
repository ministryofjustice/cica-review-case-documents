import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseQueryDslConfigFromHeader,
    parseQueryDslConfigFromQuery,
    resolveEffectiveQueryDslConfig
} from './queryDslConfigOverrides.js';

describe('queryDslConfigOverrides', () => {
    it('should parse and sanitize valid query params', () => {
        const parsed = parseQueryDslConfigFromQuery({
            semanticMinScore: '1.25',
            semanticOnlyMinScore: '0.45',
            semanticK: '120',
            lexicalBoost: '10',
            dateBoost: '2.5',
            neuralBoost: '3'
        });

        assert.deepEqual(parsed, {
            semanticMinScore: 1.25,
            semanticOnlyMinScore: 0.45,
            semanticK: 120,
            lexicalBoost: 10,
            dateBoost: 2.5,
            neuralBoost: 3
        });
    });

    it('should drop invalid query param values', () => {
        const parsed = parseQueryDslConfigFromQuery({
            semanticMinScore: '-1',
            semanticOnlyMinScore: 'abc',
            semanticK: '0',
            lexicalBoost: '-2',
            dateBoost: '',
            neuralBoost: null
        });

        assert.deepEqual(parsed, {});
    });

    it('should parse a valid header payload', () => {
        const parsed = parseQueryDslConfigFromHeader(
            JSON.stringify({
                semanticMinScore: 0.9,
                semanticOnlyMinScore: 0.33,
                semanticK: 111,
                lexicalBoost: 7,
                dateBoost: 1,
                neuralBoost: 2
            })
        );

        assert.deepEqual(parsed, {
            semanticMinScore: 0.9,
            semanticOnlyMinScore: 0.33,
            semanticK: 111,
            lexicalBoost: 7,
            dateBoost: 1,
            neuralBoost: 2
        });
    });

    it('should return undefined for an invalid header payload', () => {
        assert.equal(parseQueryDslConfigFromHeader('{not-json'), undefined);
        assert.equal(parseQueryDslConfigFromHeader('[]'), undefined);
    });

    it('should merge overrides with defaults for effective config', () => {
        const effective = resolveEffectiveQueryDslConfig({ semanticK: 80, neuralBoost: 6 });

        assert.equal(effective.semanticK, 80);
        assert.equal(effective.neuralBoost, 6);
        assert.equal(typeof effective.semanticMinScore, 'number');
    });

    it('should ignore undefined and invalid overrides when resolving effective config', () => {
        const effective = resolveEffectiveQueryDslConfig({
            semanticK: undefined,
            semanticMinScore: -1,
            lexicalBoost: 'not-a-number',
            neuralBoost: 8
        });

        // Only valid/sanitized overrides should win.
        assert.equal(effective.neuralBoost, 8);
        // Invalid/undefined values should not clobber defaults.
        assert.equal(typeof effective.semanticK, 'number');
        assert.ok(Number.isInteger(effective.semanticK));
        assert.ok(effective.semanticK >= 1);
        assert.ok(effective.semanticMinScore >= 0);
        assert.ok(effective.lexicalBoost >= 0);
    });
});
