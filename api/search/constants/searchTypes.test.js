import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, {
    DEFAULT_SEARCH_TYPE,
    parseSearchType,
    parseSearchTypeTokens
} from './searchTypes.js';

describe('SEARCH_TYPES (default export)', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(SEARCH_TYPES));
    });

    it('should map each key to the correct value', () => {
        assert.strictEqual(SEARCH_TYPES.HYBRID_DATES, 'hybrid-dates');
        assert.strictEqual(SEARCH_TYPES.KEYWORD_DATES, 'keyword-dates');
        assert.strictEqual(SEARCH_TYPES.HYBRID, 'hybrid');
        assert.strictEqual(SEARCH_TYPES.KEYWORD, 'keyword');
        assert.strictEqual(SEARCH_TYPES.SEMANTIC, 'semantic');
    });
});

describe('DEFAULT_SEARCH_TYPE', () => {
    it('should equal SEARCH_TYPES.HYBRID_DATES', () => {
        assert.strictEqual(DEFAULT_SEARCH_TYPE, SEARCH_TYPES.HYBRID_DATES);
    });

    it('should equal "hybrid-dates"', () => {
        assert.strictEqual(DEFAULT_SEARCH_TYPE, 'hybrid-dates');
    });
});

describe('parseSearchType', () => {
    describe('when value is absent or not a usable string', () => {
        for (const value of [undefined, null, 42, true, {}]) {
            it(`returns empty result for ${JSON.stringify(value)}`, () => {
                assert.deepStrictEqual(parseSearchType(value), {
                    value: undefined,
                    invalidValue: undefined
                });
            });
        }

        it('returns empty result for an empty string', () => {
            assert.deepStrictEqual(parseSearchType(''), {
                value: undefined,
                invalidValue: undefined
            });
        });

        it('returns empty result for a whitespace-only string', () => {
            assert.deepStrictEqual(parseSearchType('   '), {
                value: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('when value is an array', () => {
        it('uses the last element of the array', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', 'semantic']), {
                value: 'semantic',
                invalidValue: undefined
            });
        });

        it('returns empty result when the last element is not a string', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', undefined]), {
                value: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('supported type values', () => {
        it('resolves supported values directly', () => {
            assert.deepStrictEqual(parseSearchType('hybrid-dates'), {
                value: 'hybrid-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword-dates'), {
                value: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('hybrid'), {
                value: 'hybrid',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword'), {
                value: 'keyword',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('semantic'), {
                value: 'semantic',
                invalidValue: undefined
            });
        });
    });

    describe('invalid inputs', () => {
        it('returns the invalid value when the type is not recognised', () => {
            assert.deepStrictEqual(parseSearchType('unknown'), {
                value: undefined,
                invalidValue: 'unknown'
            });
            assert.deepStrictEqual(parseSearchType('foo,bar'), {
                value: undefined,
                invalidValue: 'foo,bar'
            });
        });
    });

    describe('whitespace and case handling', () => {
        it('trims whitespace around values', () => {
            assert.deepStrictEqual(parseSearchType(' hybrid-dates '), {
                value: 'hybrid-dates',
                invalidValue: undefined
            });
        });

        it('is case-insensitive', () => {
            assert.deepStrictEqual(parseSearchType('KEYWORD-DATES'), {
                value: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('SEMANTIC'), {
                value: 'semantic',
                invalidValue: undefined
            });
        });
    });
});

describe('parseSearchTypeTokens', () => {
    it('remains an alias of parseSearchType for compatibility', () => {
        assert.deepStrictEqual(parseSearchTypeTokens('HYBRID-DATES'), {
            value: 'hybrid-dates',
            invalidValue: undefined
        });
    });
});
