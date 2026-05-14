import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, {
    DEFAULT_SEARCH_TYPE,
    parseSearchTypeTokens,
    SEARCH_TYPE_RESOLUTIONS,
    SEARCH_TYPE_TOKENS
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
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.HYBRID_DATES, [
            'keyword',
            'semantic',
            'dates'
        ]);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.KEYWORD_DATES, ['keyword', 'dates']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.HYBRID, ['keyword', 'semantic']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.KEYWORD, ['keyword']);
        assert.deepStrictEqual(SEARCH_TYPE_RESOLUTIONS.SEMANTIC, ['semantic']);
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
            assert.deepStrictEqual(parseSearchTypeTokens(['keyword', 'keyword,semantic']), {
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
        it('does not resolve "hybrid" alone (no single-token resolution for hybrid)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('hybrid'), {
                slug: undefined,
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

        it('returns slug undefined for "semantic,dates" (no exact resolution for this combination)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('semantic,dates'), {
                slug: undefined,
                unknownTokens: []
            });
        });
    });

    describe('multi-token inputs — most-specific match wins', () => {
        it('resolves "keyword,semantic,dates" to slug "hybrid-dates"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,semantic,dates'), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('resolves "dates,semantic,keyword" (any order) to slug "hybrid-dates"', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('dates,semantic,keyword'), {
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

        it('resolves "keyword,semantic" to slug "hybrid" (no dates token)', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,semantic'), {
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
            assert.deepStrictEqual(parseSearchTypeTokens(' keyword , semantic , dates '), {
                slug: 'hybrid-dates',
                unknownTokens: []
            });
        });

        it('is case-insensitive', () => {
            assert.deepStrictEqual(parseSearchTypeTokens('KEYWORD,SEMANTIC,DATES'), {
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
            assert.deepStrictEqual(parseSearchTypeTokens('keyword,keyword'), {
                slug: 'keyword',
                unknownTokens: []
            });
        });
    });
});
