import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, {
    SEARCH_TYPE_TOKENS,
    SEARCH_TYPE_RESOLUTIONS,
    DEFAULT_SEARCH_TYPE,
    parseSearchTypeTokens
} from './searchTypes.js';

describe('SEARCH_TYPE_TOKENS', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(SEARCH_TYPE_TOKENS));
    });

    it('should contain the expected token values', () => {
        assert.deepStrictEqual(SEARCH_TYPE_TOKENS, {
            KEYWORD: 'keyword',
            DATES: 'dates',
            SEMANTIC: 'semantic',
            HYBRID: 'hybrid'
        });
    });
});

describe('SEARCH_TYPE_RESOLUTIONS', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(SEARCH_TYPE_RESOLUTIONS));
    });

    it('should list HYBRID_DATES before HYBRID (most-specific first)', () => {
        const keys = Object.keys(SEARCH_TYPE_RESOLUTIONS);
        assert.ok(keys.indexOf('HYBRID_DATES') < keys.indexOf('HYBRID'));
    });

    it('should list KEYWORD_DATES before KEYWORD (most-specific first)', () => {
        const keys = Object.keys(SEARCH_TYPE_RESOLUTIONS);
        assert.ok(keys.indexOf('KEYWORD_DATES') < keys.indexOf('KEYWORD'));
    });

    it('should define correct token arrays for each search mode', () => {
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.HYBRID_DATES, ['hybrid', 'dates']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.KEYWORD_DATES, ['keyword', 'dates']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.HYBRID, ['hybrid']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.KEYWORD, ['keyword']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.SEMANTIC, ['semantic']);
    });
});

describe('SEARCH_TYPES (default export)', () => {
    it('should be frozen', () => {
        assert.ok(Object.isFrozen(SEARCH_TYPES));
    });

    it('should derive slug values from SEARCH_TYPE_RESOLUTIONS token arrays', () => {
        assert.strictEqual(SEARCH_TYPES.HYBRID_DATES, 'hybrid-dates');
        assert.strictEqual(SEARCH_TYPES.KEYWORD_DATES, 'keyword-dates');
        assert.strictEqual(SEARCH_TYPES.HYBRID, 'hybrid');
        assert.strictEqual(SEARCH_TYPES.KEYWORD, 'keyword');
        assert.strictEqual(SEARCH_TYPES.SEMANTIC, 'semantic');
    });

    it('should have the same keys as SEARCH_TYPE_RESOLUTIONS', () => {
        assert.deepStrictEqual(Object.keys(SEARCH_TYPES), Object.keys(SEARCH_TYPE_RESOLUTIONS));
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

describe('parseSearchTypeTokens', () => {
    describe('when value is absent or not a usable string', () => {
        for (const value of [undefined, null, 42, true, {}]) {
            it(`returns empty result for ${JSON.stringify(value)}`, () => {
                assert.deepStrictEqual(parseSearchTypeTokens(value), {
                    slug: undefined,
                    unknownTokens: []
                });
            });
        }

        it('returns empty result for an empty string', () => {
            assert.deepStrictEqual(parseSearchTypeTokens(''), {
                slug: undefined,
                unknownTokens: []
            });
        });

        it('returns empty result for a whitespace-only string', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('   '), {
                slug: undefined,
                unknownTokens: []
            });
        });
    });

    describe('when value is an array', () => {
        it('uses the last element of the array', () => {
            assert.deepStrictEqual(parseSearchTypeTokens(['keyword', 'hybrid']), {
                slug: 'hybrid',
                unknownTokens: []
            });
        });

        it('returns empty result when the last element is not a string', () => {
            assert.deepStrictEqual(parseSearchTypeTokens(['keyword', undefined]), {
                slug: undefined,
                unknownTokens: []
            });
        });
    });

    describe('single-token inputs', () => {
        it('resolves "hybrid" to slug "hybrid"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('hybrid'), {
                slug: 'hybrid',
                unknownTokens: []
            });
        });

        it('resolves "keyword" to slug "keyword"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword'), {
                slug: 'keyword',
                unknownTokens: []
            });
        });

        it('resolves "semantic" to slug "semantic"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('semantic'), {
                slug: 'semantic',
                unknownTokens: []
            });
        });

        it('returns slug undefined for "dates" alone (no matching resolution)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('dates'), {
                slug: undefined,
                unknownTokens: []
            });
        });
    });

    describe('multi-token inputs — most-specific match wins', () => {
        it('resolves "hybrid,dates" to slug "hybrid-dates"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('hybrid,dates'), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('resolves "dates,hybrid" (reversed order) to slug "hybrid-dates"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('dates,hybrid'), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('resolves "keyword,dates" to slug "keyword-dates"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,dates'), {
                slug: 'keyword-dates',
                unknownTokens: []
            });
        });

        it('resolves "keyword,hybrid" to slug "hybrid" (HYBRID_DATES requires dates; HYBRID matches first)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,hybrid'), {
                slug: 'hybrid',
                unknownTokens: []
            });
        });
    });

    describe('inputs with unknown tokens', () => {
        it('collects unknown tokens and still resolves the slug when valid tokens are sufficient', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,unknown,dates'), {
                slug: 'keyword-dates',
                unknownTokens: ['unknown']
            });
        });

        it('returns slug undefined when the only token is unknown', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('unknown'), {
                slug: undefined,
                unknownTokens: ['unknown']
            });
        });

        it('collects multiple unknown tokens', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('foo,bar'), {
                slug: undefined,
                unknownTokens: ['foo', 'bar']
            });
        });

        it('collects unknown tokens even when valid tokens produce no matching resolution', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('dates,foo'), {
                slug: undefined,
                unknownTokens: ['foo']
            });
        });
    });

    describe('whitespace and case handling', () => {
        it('trims whitespace around tokens', () => {
            assert.deepStrictEqual(parseSearchTypeTokens(' hybrid , dates '), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('is case-insensitive', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('HYBRID,DATES'), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('handles mixed case', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('Keyword,Dates'), {
                slug: 'keyword-dates',
                unknownTokens: []
            });
        });
    });

    describe('duplicate tokens', () => {
        it('treats duplicate valid tokens as a single token (set deduplication)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('hybrid,hybrid'), {
                slug: 'hybrid',
                unknownTokens: []
            });
        });
    });
});
