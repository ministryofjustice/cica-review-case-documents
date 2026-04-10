import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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

    it('updates hybrid flag from query string', () => {
        const req = {
            query: { hybrid: 'on' },
            session: {}
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.hybrid, true);
        assert.equal(req.session.featureFlags.align, true);
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
        assert.equal(req.session.featureFlags.hybrid, false);
    });

    it('preserves existing feature flag values when the query string is absent', () => {
        const req = {
            query: {},
            session: {
                featureFlags: {
                    align: false,
                    hybrid: true
                }
            }
        };
        const res = {
            locals: {}
        };

        featureFlags(req, res, () => {});

        assert.deepEqual(req.session.featureFlags, {
            align: false,
            hybrid: true
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
        assert.equal(getFeatureFlagValue({ featureFlags: { hybrid: true } }, 'hybrid'), true);
        assert.equal(getFeatureFlagValue({ featureFlags: { align: false } }, 'align'), false);
    });

    it('falls back to defaults when the session value is missing', () => {
        assert.equal(getFeatureFlagValue({}, 'hybrid'), false);
        assert.equal(getFeatureFlagValue({}, 'align'), true);
    });
});
