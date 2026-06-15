import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import buildSearchSessionPreference from './buildSearchSessionPreference.js';

describe('buildSearchSessionPreference', () => {
    it('returns the expected deterministic preference for a known search term', () => {
        const result = buildSearchSessionPreference('acute 28 January 2018');

        assert.equal(
            result,
            'session-5d3203e0f2107dcdc26803e5a828fbb6b1248871273ceb7cae2ddf8aa9096b76'
        );
    });

    it('returns different preferences for different search terms', () => {
        const first = buildSearchSessionPreference('acute');
        const second = buildSearchSessionPreference('chronic');

        assert.notEqual(first, second);
    });

    it('returns a session-prefixed hash for an empty search term', () => {
        const result = buildSearchSessionPreference('');

        assert.match(result, /^session-[0-9a-f]{64}$/);
    });
});
