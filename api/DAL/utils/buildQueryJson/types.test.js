import assert from 'node:assert';
import { describe, it } from 'node:test';
import { SEARCH_TYPES } from './types.js';

describe('types', () => {
    describe('SEARCH_TYPES', () => {
        it('Should define all three search type constants', () => {
            assert.strictEqual(SEARCH_TYPES.KEYWORD, 'keyword');
            assert.strictEqual(SEARCH_TYPES.SEMANTIC, 'semantic');
            assert.strictEqual(SEARCH_TYPES.HYBRID, 'hybrid');
        });

        it('Should have consistent keys and values', () => {
            const keys = Object.keys(SEARCH_TYPES);
            assert.deepStrictEqual(keys, ['KEYWORD', 'SEMANTIC', 'HYBRID']);

            const values = Object.values(SEARCH_TYPES);
            assert.deepStrictEqual(values, ['keyword', 'semantic', 'hybrid']);
        });

        it('Should be immutable in strict mode', () => {
            assert.throws(() => {
                SEARCH_TYPES.KEYWORD = 'modified';
            }, TypeError);
        });

        it('Should have the correct count of search types', () => {
            assert.strictEqual(Object.keys(SEARCH_TYPES).length, 3);
        });
    });
});
