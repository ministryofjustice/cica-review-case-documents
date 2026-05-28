import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SEARCH_TYPE } from '../../api/search/constants/searchTypes.js';
import featureFlags, {
    FEATURE_FLAG_DEFAULTS,
    getFeatureFlagValue,
    parseEnumFlagValue,
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

    it('falls back to session type value when type query param is unrecognised', () => {
        const req = {
            query: { type: 'unknown' },
            session: { featureFlags: { align: true, type: 'semantic' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'semantic');
    });

    it('falls back to DEFAULT_SEARCH_TYPE when type is unrecognised and no session override exists', () => {
        const req = {
            query: { type: 'unknown' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('falls back to DEFAULT_SEARCH_TYPE when type uses an old comma-separated format', () => {
        const req = {
            query: { type: 'keyword,semantic,dates' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('falls back to DEFAULT_SEARCH_TYPE when type is empty/whitespace and no session value exists', () => {
        const req = {
            query: { type: '   ' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('preserves existing session type when type query param is empty/whitespace', () => {
        const req = {
            query: { type: '   ' },
            session: { featureFlags: { type: 'semantic' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'semantic');
    });

    it('preserves existing session type value when type query param is absent', () => {
        const req = {
            query: {},
            session: { featureFlags: { align: false, type: 'hybrid' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
        assert.equal(req.session.featureFlags.type, 'hybrid');
    });

    it('normalises repeated type parameters to the last valid element', () => {
        const req = {
            query: { type: ['invalid', 'keyword'] },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'keyword');
    });

    it('falls back to session/default when repeated type has invalid final element', () => {
        const req = {
            query: { type: ['keyword', 'not-a-type'] },
            session: { featureFlags: { type: 'semantic' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'semantic');
    });

    it('corrects stale/invalid session type to DEFAULT_SEARCH_TYPE when no query param provided', () => {
        const req = {
            query: {},
            session: { featureFlags: { type: 'old-invalid-type' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        // Invalid session type should be corrected to the default
        assert.equal(req.session.featureFlags.type, DEFAULT_SEARCH_TYPE);
        assert.equal(res.locals.featureFlags.type, DEFAULT_SEARCH_TYPE);
    });

    it('overrides stale session type with valid query param', () => {
        const req = {
            query: { type: 'hybrid' },
            session: { featureFlags: { type: 'old-invalid-type' } }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        // Valid query param should override stale session type
        assert.equal(req.session.featureFlags.type, 'hybrid');
        assert.equal(res.locals.featureFlags.type, 'hybrid');
    });
});

describe('parseEnumFlagValue', () => {
    it('returns the trimmed lowercase value when it matches the allowlist', () => {
        assert.equal(parseEnumFlagValue('hybrid', ['hybrid', 'semantic']), 'hybrid');
        assert.equal(parseEnumFlagValue('  SEMANTIC  ', ['hybrid', 'semantic']), 'semantic');
    });

    it('returns undefined when the value is not in the allowlist', () => {
        assert.equal(parseEnumFlagValue('unknown', ['hybrid', 'semantic']), undefined);
    });

    it('accepts any non-empty string when no allowlist is provided', () => {
        assert.equal(parseEnumFlagValue('anything'), 'anything');
        assert.equal(parseEnumFlagValue('  trimmed  '), 'trimmed');
    });

    it('returns undefined for empty or whitespace-only strings', () => {
        assert.equal(parseEnumFlagValue(''), undefined);
        assert.equal(parseEnumFlagValue('   '), undefined);
    });

    it('returns undefined for non-string values', () => {
        assert.equal(parseEnumFlagValue(undefined), undefined);
        assert.equal(parseEnumFlagValue(null), undefined);
        assert.equal(parseEnumFlagValue(42), undefined);
    });

    it('uses the last element when given an array', () => {
        assert.equal(
            parseEnumFlagValue(['hybrid', 'semantic'], ['hybrid', 'semantic']),
            'semantic'
        );
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
