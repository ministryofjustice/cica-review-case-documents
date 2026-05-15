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

    it('accepts supported search type slugs directly', () => {
        const req = { query: { type: 'hybrid-dates' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'hybrid-dates');
    });

    it('normalises supported search type slugs', () => {
        const req = { query: { type: ' KEYWORD-DATES ' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'keyword-dates');
    });

    it('calls next with a 400 error when type is not recognised', () => {
        const req = {
            query: { type: 'unknown' },
            session: { featureFlags: { align: true, type: DEFAULT_SEARCH_TYPE } }
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.ok(errorPassed instanceof Error);
        assert.equal(errorPassed.status, 400);
        assert.match(errorPassed.message, /unknown/);
    });

    it('calls next with a 400 when type uses the old token-combination format', () => {
        const req = {
            query: { type: 'keyword,semantic,dates' },
            session: {}
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.ok(errorPassed instanceof Error);
        assert.equal(errorPassed.status, 400);
        assert.match(errorPassed.message, /keyword,semantic,dates/);
    });

    it('calls next with a 400 when type is empty', () => {
        const req = {
            query: { type: '   ' },
            session: { featureFlags: { align: true, type: 'hybrid-dates' } }
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        assert.ok(errorPassed instanceof Error);
        assert.equal(errorPassed.status, 400);
        assert.match(errorPassed.message, /\(empty\)/);
    });

    it('does not fall through to the previous session value when type is invalid', () => {
        const req = {
            query: { type: 'semantic,dates' },
            session: { featureFlags: { align: true, type: 'hybrid-dates' } }
        };
        const res = { locals: {} };
        let errorPassed;

        featureFlags(req, res, (err) => {
            errorPassed = err;
        });

        // session must NOT be silently updated to the stale 'hybrid-dates' value
        assert.ok(errorPassed instanceof Error);
        assert.equal(req.session.featureFlags?.type, 'hybrid-dates'); // unchanged
    });
});

describe('parseSearchType', () => {
    it('resolves supported slugs directly', () => {
        assert.deepEqual(parseSearchType('keyword'), {
            slug: 'keyword',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('semantic'), {
            slug: 'semantic',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('hybrid'), {
            slug: 'hybrid',
            invalidValue: undefined
        });
    });

    it('is case-insensitive and trims whitespace', () => {
        assert.deepEqual(parseSearchType('  KEYWORD-DATES  '), {
            slug: 'keyword-dates',
            invalidValue: undefined
        });
        assert.deepEqual(parseSearchType('HyBrId-DaTeS'), {
            slug: 'hybrid-dates',
            invalidValue: undefined
        });
    });

    it('accepts array input and uses the last value', () => {
        assert.deepEqual(parseSearchType(['keyword', 'semantic']), {
            slug: 'semantic',
            invalidValue: undefined
        });
    });

    it('returns invalid values for unsupported slugs', () => {
        assert.deepEqual(parseSearchType('unknown'), {
            slug: undefined,
            invalidValue: 'unknown'
        });
        assert.deepEqual(parseSearchType('keyword,semantic'), {
            slug: undefined,
            invalidValue: 'keyword,semantic'
        });
    });

    it('returns empty output for absent or empty input', () => {
        assert.deepEqual(parseSearchType(''), { slug: undefined, invalidValue: undefined });
        assert.deepEqual(parseSearchType(undefined), {
            slug: undefined,
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
