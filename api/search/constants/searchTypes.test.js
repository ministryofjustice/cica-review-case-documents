import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, {
    DEFAULT_SEARCH_TYPE,
    parseSearchType,
    parseSearchTypeTokens,
    VALID_SEARCH_TYPE_SET,
    VALID_SEARCH_TYPE_VALUES
} from './searchTypes.js';

describe('VALID_SEARCH_TYPE_SET', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(VALID_SEARCH_TYPE_SET));
    });

    it('should contain each supported URL type value', () => {
        assert.deepStrictEqual(Array.from(VALID_SEARCH_TYPE_SET), [
            'hybrid-dates',
            'keyword-dates',
            'hybrid',
            'keyword',
            'semantic'
        ]);
    });
});

describe('VALID_SEARCH_TYPE_VALUES', () => {
    it('should contain every supported URL type value', () => {
        assert.deepStrictEqual(VALID_SEARCH_TYPE_VALUES, [
            'hybrid-dates',
            'keyword-dates',
            'hybrid',
            'keyword',
            'semantic'
        ]);
    });
});

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
                    searchType: undefined,
                    invalidValue: undefined
                });
            });
        }

        it('returns empty result for an empty string', () => {
            assert.deepStrictEqual(parseSearchType(''), {
                searchType: undefined,
                invalidValue: undefined
            });
        });

        it('returns empty result for a whitespace-only string', () => {
            assert.deepStrictEqual(parseSearchType('   '), {
                searchType: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('when value is an array', () => {
        it('uses the last element of the array', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', 'semantic']), {
                searchType: 'semantic',
                invalidValue: undefined
            });
        });

        it('returns empty result when the last element is not a string', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', undefined]), {
                searchType: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('supported enum values', () => {
        it('resolves supported values directly', () => {
            assert.deepStrictEqual(parseSearchType('hybrid-dates'), {
                searchType: 'hybrid-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword-dates'), {
                searchType: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('hybrid'), {
                searchType: 'hybrid',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword'), {
                searchType: 'keyword',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('semantic'), {
                searchType: 'semantic',
                invalidValue: undefined
            });
        });
    });

    describe('invalid inputs', () => {
        it('returns the invalid value when the value is not supported', () => {
            assert.deepStrictEqual(parseSearchType('unknown'), {
                searchType: undefined,
                invalidValue: 'unknown'
            });
            assert.deepStrictEqual(parseSearchType('foo,bar'), {
                searchType: undefined,
                invalidValue: 'foo,bar'
            });
        });
    });

    describe('whitespace and case handling', () => {
        it('trims whitespace around values', () => {
            assert.deepStrictEqual(parseSearchType(' hybrid-dates '), {
                searchType: 'hybrid-dates',
                invalidValue: undefined
            });
        });

        it('is case-insensitive', () => {
            assert.deepStrictEqual(parseSearchType('KEYWORD-DATES'), {
                searchType: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('SEMANTIC'), {
                searchType: 'semantic',
                invalidValue: undefined
            });
        });
    });
});

describe('parseSearchTypeTokens', () => {
    it('remains an alias of parseSearchType for compatibility', () => {
        assert.deepStrictEqual(parseSearchTypeTokens('HYBRID-DATES'), {
            searchType: 'hybrid-dates',
            invalidValue: undefined
        });
    });
});
