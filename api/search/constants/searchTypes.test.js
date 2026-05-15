import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, {
    DEFAULT_SEARCH_TYPE,
    parseSearchType,
    parseSearchTypeTokens,
    SEARCH_TYPE_RESOLUTIONS,
    VALID_SEARCH_TYPE_VALUES
} from './searchTypes.js';

describe('SEARCH_TYPE_RESOLUTIONS', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(SEARCH_TYPE_RESOLUTIONS));
    });

    it('should map each supported URL type directly to the same slug', () => {
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS, {
            'hybrid-dates': 'hybrid-dates',
            'keyword-dates': 'keyword-dates',
            hybrid: 'hybrid',
            keyword: 'keyword',
            semantic: 'semantic'
        });
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

    it('should map each key to the correct slug', () => {
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
                    slug: undefined,
                    invalidValue: undefined
                });
            });
        }

        it('returns empty result for an empty string', () => {
            assert.deepStrictEqual(parseSearchType(''), {
                slug: undefined,
                invalidValue: undefined
            });
        });

        it('returns empty result for a whitespace-only string', () => {
            assert.deepStrictEqual(parseSearchType('   '), {
                slug: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('when value is an array', () => {
        it('uses the last element of the array', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', 'semantic']), {
                slug: 'semantic',
                invalidValue: undefined
            });
        });

        it('returns empty result when the last element is not a string', () => {
            assert.deepStrictEqual(parseSearchType(['keyword', undefined]), {
                slug: undefined,
                invalidValue: undefined
            });
        });
    });

    describe('supported slug inputs', () => {
        it('resolves supported slugs directly', () => {
            assert.deepStrictEqual(parseSearchType('hybrid-dates'), {
                slug: 'hybrid-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword-dates'), {
                slug: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('hybrid'), {
                slug: 'hybrid',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('keyword'), {
                slug: 'keyword',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('semantic'), {
                slug: 'semantic',
                invalidValue: undefined
            });
        });
    });

    describe('invalid inputs', () => {
        it('returns the invalid value when the slug is not supported', () => {
            assert.deepStrictEqual(parseSearchType('unknown'), {
                slug: undefined,
                invalidValue: 'unknown'
            });
            assert.deepStrictEqual(parseSearchType('foo,bar'), {
                slug: undefined,
                invalidValue: 'foo,bar'
            });
        });
    });

    describe('whitespace and case handling', () => {
        it('trims whitespace around values', () => {
            assert.deepStrictEqual(parseSearchType(' hybrid-dates '), {
                slug: 'hybrid-dates',
                invalidValue: undefined
            });
        });

        it('is case-insensitive', () => {
            assert.deepStrictEqual(parseSearchType('KEYWORD-DATES'), {
                slug: 'keyword-dates',
                invalidValue: undefined
            });
            assert.deepStrictEqual(parseSearchType('SEMANTIC'), {
                slug: 'semantic',
                invalidValue: undefined
            });
        });
    });
});

describe('parseSearchTypeTokens', () => {
    it('remains an alias of parseSearchType for compatibility', () => {
        assert.deepStrictEqual(parseSearchTypeTokens('HYBRID-DATES'), {
            slug: 'hybrid-dates',
            invalidValue: undefined
        });
    });
});
