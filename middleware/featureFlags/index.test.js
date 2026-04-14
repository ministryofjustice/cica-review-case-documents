import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import featureFlags, {
    FEATURE_FLAG_DEFAULTS,
    FEATURE_FLAG_ENUM_OPTIONS,
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

    it('ignores unknown boolean flags from query string', () => {
        const req = {
            query: { hybrid: 'on' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.hybrid, undefined);
        assert.equal(req.session.featureFlags.align, true);
        assert.equal(req.session.featureFlags.type, 'keyword');
    });

    it('updates align flag from query string', () => {
        const req = {
            query: { align: 'off' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
        assert.equal(req.session.featureFlags.type, 'keyword');
    });

    it('updates type flag from query string', () => {
        const req = {
            query: { type: 'semantic' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'semantic');
    });

    it('accepts all valid type enum values from query string', () => {
        for (const typeValue of FEATURE_FLAG_ENUM_OPTIONS.type) {
            const req = {
                query: { type: typeValue },
                session: {}
            };
            const res = { locals: {} };

            featureFlags(req, res, () => {});

            assert.equal(req.session.featureFlags.type, typeValue);
        }
    });

    it('ignores invalid type flag values from query string', () => {
        const req = {
            query: { type: 'invalid' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, 'keyword');
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
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.deepEqual(req.session.featureFlags, {
            align: false,
            type: 'hybrid'
        });
    });

    it('ignores invalid query-string values', () => {
        const req = {
            query: { hybrid: 'maybe', align: 'sometimes' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.deepEqual(req.session.featureFlags, FEATURE_FLAG_DEFAULTS);
    });
});

describe('parseEnumFlagValue', () => {
    it('returns the value when it is in the allowed set', () => {
        assert.equal(parseEnumFlagValue('keyword', FEATURE_FLAG_ENUM_OPTIONS.type), 'keyword');
        assert.equal(parseEnumFlagValue('semantic', FEATURE_FLAG_ENUM_OPTIONS.type), 'semantic');
        assert.equal(parseEnumFlagValue('hybrid', FEATURE_FLAG_ENUM_OPTIONS.type), 'hybrid');
    });

    it('accepts the last element when given an array', () => {
        assert.equal(
            parseEnumFlagValue(['keyword', 'semantic'], FEATURE_FLAG_ENUM_OPTIONS.type),
            'semantic'
        );
    });

    it('returns undefined for values not in the allowed set', () => {
        assert.equal(parseEnumFlagValue('all', FEATURE_FLAG_ENUM_OPTIONS.type), undefined);
        assert.equal(parseEnumFlagValue('', FEATURE_FLAG_ENUM_OPTIONS.type), undefined);
        assert.equal(parseEnumFlagValue(undefined, FEATURE_FLAG_ENUM_OPTIONS.type), undefined);
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
    });

    it('falls back to defaults when the session value is missing', () => {
        assert.equal(getFeatureFlagValue({}, 'align'), true);
    });

    it('returns the session value for enum flags when valid', () => {
        assert.equal(
            getFeatureFlagValue({ featureFlags: { type: 'semantic' } }, 'type'),
            'semantic'
        );
        assert.equal(getFeatureFlagValue({ featureFlags: { type: 'hybrid' } }, 'type'), 'hybrid');
        assert.equal(getFeatureFlagValue({ featureFlags: { type: 'keyword' } }, 'type'), 'keyword');
    });

    it('falls back to the default for enum flags when the session value is missing or invalid', () => {
        assert.equal(getFeatureFlagValue({}, 'type'), 'keyword');
        assert.equal(getFeatureFlagValue({ featureFlags: { type: 'invalid' } }, 'type'), 'keyword');
        assert.equal(getFeatureFlagValue({ featureFlags: { type: 123 } }, 'type'), 'keyword');
    });
});
