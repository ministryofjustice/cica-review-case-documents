import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import featureFlags, {
    FEATURE_FLAG_DEFAULTS,
    getFeatureFlagValue,
    parseFeatureFlagValue
} from './index.js';
import {
    parseSearchTypeTokens,
    DEFAULT_SEARCH_TYPE
} from '../../api/search/constants/searchTypes.js';

describe('featureFlags middleware', () => {
    it('sets default feature flags in session and res.locals', () => {
        const req = {
            query: {},
            session: {}
        };
        const res = {
            locals: {}
        };

        let nextCalled = false;
        featureFlags(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.deepEqual(req.session.featureFlags, FEATURE_FLAG_DEFAULTS);
        assert.deepEqual(res.locals.featureFlags, FEATURE_FLAG_DEFAULTS);
    });

    it(`defaults: align=true, type=${DEFAULT_SEARCH_TYPE}`, () => {
        const req = { query: {}, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, true);
        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('ignores unknown flags from query string', () => {
        const req = {
            query: { type: 'hybrid', unknown: 'on' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'hybrid');
        assert.equal(req.session.featureFlags.unknown, undefined);
        assert.equal(req.session.featureFlags.align, true);
    });

    it('updates align flag from query string', () => {
        const req = { query: { align: 'off' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
    });

    it('preserves existing feature flag values when the query string is absent', () => {
        const req = {
            query: {},
            session: {
                featureFlags: {
                    align: false,
                    type: 'hybrid'
                }
            }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
        assert.equal(req.session.featureFlags.type, 'hybrid');
    });

    it('ignores invalid query-string values', () => {
        const req = {
            query: { keyword: 'maybe', align: 'not-a-valid-type' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.deepEqual(req.session.featureFlags, FEATURE_FLAG_DEFAULTS);
    });

    it('resolves type from comma-delimited tokens (hybrid,dates)', () => {
        const req = { query: { type: 'hybrid,dates' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'hybrid-dates');
    });

    it('resolves type from comma-delimited tokens in any order (dates,keyword)', () => {
        const req = { query: { type: 'dates,keyword' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'keyword-dates');
    });

    it('calls next with a 400 error when type contains unrecognised tokens', () => {
        const req = {
            query: { type: 'unknown,foo' },
            session: { featureFlags: { align: true, type: DEFAULT_SEARCH_TYPE } }
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.ok(errorPassed instanceof Error);
        assert.equal(errorPassed.status, 400);
        assert.match(errorPassed.message, /unknown, foo/);
    });

    it('calls next with a 400 when type mixes valid and invalid tokens', () => {
        const req = {
            query: { type: 'hybrid,badtoken' },
            session: {}
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.ok(errorPassed instanceof Error);
        assert.equal(errorPassed.status, 400);
        assert.match(errorPassed.message, /badtoken/);
    });
});

describe('parseSearchTypeTokens', () => {
    it('resolves single tokens', () => {
        assert.deepEqual(parseSearchTypeTokens('keyword'), { slug: 'keyword', unknownTokens: [] });
        assert.deepEqual(parseSearchTypeTokens('semantic'), {
            slug: 'semantic',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('hybrid'), { slug: 'hybrid', unknownTokens: [] });
    });

    it('resolves two-token combinations regardless of order', () => {
        assert.deepEqual(parseSearchTypeTokens('keyword,dates'), {
            slug: 'keyword-dates',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('dates,keyword'), {
            slug: 'keyword-dates',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('hybrid,dates'), {
            slug: 'hybrid-dates',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('dates,hybrid'), {
            slug: 'hybrid-dates',
            unknownTokens: []
        });
    });

    it('hybrid wins over keyword when both present', () => {
        assert.deepEqual(parseSearchTypeTokens('keyword,hybrid'), {
            slug: 'hybrid',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('keyword,hybrid,dates'), {
            slug: 'hybrid-dates',
            unknownTokens: []
        });
    });

    it('dates paired with semantic returns semantic (dates is not a semantic token)', () => {
        assert.deepEqual(parseSearchTypeTokens('semantic,dates'), {
            slug: 'semantic',
            unknownTokens: []
        });
    });

    it('collects unrecognised tokens and still resolves from valid remainder', () => {
        assert.deepEqual(parseSearchTypeTokens('keyword,unknown,dates'), {
            slug: 'keyword-dates',
            unknownTokens: ['unknown']
        });
        assert.deepEqual(parseSearchTypeTokens('unknown,hybrid'), {
            slug: 'hybrid',
            unknownTokens: ['unknown']
        });
    });

    it('is case-insensitive and trims whitespace', () => {
        assert.deepEqual(parseSearchTypeTokens('Hybrid, Dates'), {
            slug: 'hybrid-dates',
            unknownTokens: []
        });
        assert.deepEqual(parseSearchTypeTokens('  KEYWORD , DATES  '), {
            slug: 'keyword-dates',
            unknownTokens: []
        });
    });

    it('accepts array input and uses the last value', () => {
        assert.deepEqual(parseSearchTypeTokens(['keyword', 'hybrid,dates']), {
            slug: 'hybrid-dates',
            unknownTokens: []
        });
    });

    it('returns undefined slug with unknownTokens for direct hyphenated slugs', () => {
        assert.deepEqual(parseSearchTypeTokens('hybrid-dates'), {
            slug: undefined,
            unknownTokens: ['hybrid-dates']
        });
        assert.deepEqual(parseSearchTypeTokens('keyword-dates'), {
            slug: undefined,
            unknownTokens: ['keyword-dates']
        });
    });

    it('returns undefined slug with unknownTokens when all tokens are unrecognised', () => {
        assert.deepEqual(parseSearchTypeTokens('unknown'), {
            slug: undefined,
            unknownTokens: ['unknown']
        });
        assert.deepEqual(parseSearchTypeTokens('unknown,foo'), {
            slug: undefined,
            unknownTokens: ['unknown', 'foo']
        });
    });

    it('returns undefined slug with empty unknownTokens for absent or empty input', () => {
        assert.deepEqual(parseSearchTypeTokens(''), { slug: undefined, unknownTokens: [] });
        assert.deepEqual(parseSearchTypeTokens(undefined), { slug: undefined, unknownTokens: [] });
    });

    it('returns undefined slug with empty unknownTokens for dates alone', () => {
        assert.deepEqual(parseSearchTypeTokens('dates'), { slug: undefined, unknownTokens: [] });
    });
});

describe('parseFeatureFlagValue', () => {
    it('parses supported on and off values', () => {
        assert.equal(parseFeatureFlagValue('on'), true);
        assert.equal(parseFeatureFlagValue('off'), false);
        assert.equal(parseFeatureFlagValue(['off']), false);
    });

    it('returns undefined for unsupported values', () => {
        assert.equal(parseFeatureFlagValue('other'), undefined);
        assert.equal(parseFeatureFlagValue(undefined), undefined);
    });
});

describe('getFeatureFlagValue', () => {
    it('returns the session value when present', () => {
        assert.equal(getFeatureFlagValue({ featureFlags: { align: false } }, 'align'), false);
        assert.equal(getFeatureFlagValue({ featureFlags: { type: 'hybrid' } }, 'type'), 'hybrid');
    });

    it('falls back to defaults when the session value is missing', () => {
        assert.equal(getFeatureFlagValue({}, 'align'), true);
        assert.equal(getFeatureFlagValue({}, 'type'), DEFAULT_SEARCH_TYPE);
    });
});
