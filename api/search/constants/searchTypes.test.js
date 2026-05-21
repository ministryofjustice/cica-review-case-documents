import assert from 'node:assert';
import { describe, it } from 'node:test';
import SEARCH_TYPES, { DEFAULT_SEARCH_TYPE, resolveSearchType } from './searchTypes.js';

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

describe('resolveSearchType', () => {
    describe('when value is absent or not a usable string', () => {
        for (const value of [undefined, null, 42, true, {}]) {
            it(`returns DEFAULT_SEARCH_TYPE for ${JSON.stringify(value)}`, () => {
                assert.strictEqual(resolveSearchType(value), DEFAULT_SEARCH_TYPE);
            });
        }

        it('returns DEFAULT_SEARCH_TYPE for an empty string', () => {
            assert.strictEqual(resolveSearchType(''), DEFAULT_SEARCH_TYPE);
        });

        it('returns DEFAULT_SEARCH_TYPE for a whitespace-only string', () => {
            assert.strictEqual(resolveSearchType('   '), DEFAULT_SEARCH_TYPE);
        });

        it('returns DEFAULT_SEARCH_TYPE for an array (arrays are not strings)', () => {
            assert.strictEqual(resolveSearchType(['keyword', 'semantic']), DEFAULT_SEARCH_TYPE);
        });
    });

    describe('supported type values', () => {
        it('resolves all supported values directly', () => {
            assert.strictEqual(resolveSearchType('hybrid-dates'), 'hybrid-dates');
            assert.strictEqual(resolveSearchType('keyword-dates'), 'keyword-dates');
            assert.strictEqual(resolveSearchType('hybrid'), 'hybrid');
            assert.strictEqual(resolveSearchType('keyword'), 'keyword');
            assert.strictEqual(resolveSearchType('semantic'), 'semantic');
        });
    });

    describe('unrecognised inputs', () => {
        it('returns DEFAULT_SEARCH_TYPE when the type is not recognised and no session fallback exists', () => {
            assert.strictEqual(resolveSearchType('unknown'), DEFAULT_SEARCH_TYPE);
            assert.strictEqual(resolveSearchType('foo,bar'), DEFAULT_SEARCH_TYPE);
        });

        it('returns the session feature-flag value when the type is not recognised and a session override is set', () => {
            const session = { featureFlags: { type: 'semantic' } };
            assert.strictEqual(resolveSearchType('unknown', session), 'semantic');
        });

        it('returns DEFAULT_SEARCH_TYPE when the session feature-flag value is falsy', () => {
            assert.strictEqual(resolveSearchType('unknown', {}), DEFAULT_SEARCH_TYPE);
            assert.strictEqual(
                resolveSearchType('unknown', { featureFlags: {} }),
                DEFAULT_SEARCH_TYPE
            );
        });

        it('returns DEFAULT_SEARCH_TYPE when the session feature-flag type is not a recognised value', () => {
            const session = { featureFlags: { type: 'not-a-real-type' } };
            assert.strictEqual(resolveSearchType('unknown', session), DEFAULT_SEARCH_TYPE);
        });

        it('returns DEFAULT_SEARCH_TYPE when the session feature-flag type is a comma-separated invalid value', () => {
            const session = { featureFlags: { type: 'keyword,semantic' } };
            assert.strictEqual(resolveSearchType('unknown', session), DEFAULT_SEARCH_TYPE);
        });
    });

    describe('whitespace and case handling', () => {
        it('trims whitespace around values', () => {
            assert.strictEqual(resolveSearchType(' hybrid-dates '), 'hybrid-dates');
        });

        it('is case-insensitive', () => {
            assert.strictEqual(resolveSearchType('KEYWORD-DATES'), 'keyword-dates');
            assert.strictEqual(resolveSearchType('SEMANTIC'), 'semantic');
        });
    });
});
