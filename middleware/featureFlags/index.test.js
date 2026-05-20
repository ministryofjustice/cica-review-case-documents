import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SEARCH_TYPE, parseSearchType } from '../../api/search/constants/searchTypes.js';
import featureFlags, {
    FEATURE_FLAG_DEFAULTS,
    getFeatureFlagValue,
    parseFeatureFlagValue
} from './index.js';

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

    it('accepts supported search type values directly', () => {
        const req = { query: { type: 'hybrid-dates' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'hybrid-dates');
    });

    it('normalises supported search type values', () => {
        const req = { query: { type: ' KEYWORD-DATES ' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'keyword-dates');
    });

    it('keeps session/default type when type is not recognised', () => {
        const req = {
            query: { type: 'unknown' },
            session: { featureFlags: { align: true, type: DEFAULT_SEARCH_TYPE } }
        };
        const res = { locals: {} };
        let errorPassed = null;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.equal(errorPassed, undefined);
        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('keeps existing session type when type uses token-combination format', () => {
        const req = {
            query: { type: 'keyword,semantic,dates' },
            session: { featureFlags: { align: true, type: 'keyword' } }
        };
        const res = { locals: {} };
        let errorPassed = null;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.equal(errorPassed, undefined);
        assert.equal(req.session.featureFlags.type, 'keyword');
    });

    it('keeps existing session type when type is empty', () => {
        const req = {
            query: { type: '   ' },
            session: { featureFlags: { align: true, type: 'hybrid-dates' } }
        };
        const res = { locals: {} };
        let errorPassed = null;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.equal(errorPassed, undefined);
        assert.equal(req.session.featureFlags.type, 'hybrid-dates');
    });

    it('falls back to the previous session value when type is invalid', () => {
        const req = {
            query: { type: 'semantic,dates' },
            session: { featureFlags: { align: true, type: 'hybrid-dates' } }
        };
        const res = { locals: {} };
        let errorPassed = null;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.equal(errorPassed, undefined);
        assert.equal(req.session.featureFlags?.type, 'hybrid-dates');
    });
});

describe('parseSearchType', () => {
    it('resolves supported values directly', () => {
        assert.deepEqual(parseSearchType('keyword'), {
            searchType: 'keyword',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('semantic'), {
            searchType: 'semantic',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('hybrid'), {
            searchType: 'hybrid',
            invalidValue: undefined
        });
    });

    it('is case-insensitive and trims whitespace', () => {
        assert.deepEqual(parseSearchType('  KEYWORD-DATES  '), {
            searchType: 'keyword-dates',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('HyBrId-DaTeS'), {
            searchType: 'hybrid-dates',
            invalidValue: undefined
        });
    });

    it('accepts array input and uses the last value', () => {
        assert.deepEqual(parseSearchType(['keyword', 'semantic']), {
            searchType: 'semantic',
            invalidValue: undefined
        });
    });

    it('returns invalid values for unsupported values', () => {
        assert.deepEqual(parseSearchType('unknown'), {
            searchType: undefined,
            invalidValue: 'unknown'
        });
        assert.deepEqual(parseSearchType('keyword,semantic'), {
            searchType: undefined,
            invalidValue: 'keyword,semantic'
        });
    });

    it('returns empty output for absent or empty input', () => {
        assert.deepEqual(parseSearchType(''), { searchType: undefined, invalidValue: undefined });
        assert.deepEqual(parseSearchType(undefined), {
            searchType: undefined,
            invalidValue: undefined
        });
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
