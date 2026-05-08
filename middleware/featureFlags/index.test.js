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

    it('defaults: align=true, keyword=true, semantic=false, dates=true', () => {
        const req = { query: {}, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, true);
        assert.equal(req.session.featureFlags.keyword, true);
        assert.equal(req.session.featureFlags.semantic, false);
        assert.equal(req.session.featureFlags.dates, true);
    });

    it('ignores unknown flags from query string', () => {
        const req = {
            query: { type: 'hybrid', unknown: 'on' },
            session: {}
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.type, undefined);
        assert.equal(req.session.featureFlags.unknown, undefined);
        assert.equal(req.session.featureFlags.keyword, true);
    });

    it('updates align flag from query string', () => {
        const req = { query: { align: 'off' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
    });

    it('enables semantic flag from query string', () => {
        const req = { query: { semantic: 'on' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.semantic, true);
    });

    it('disables keyword flag from query string', () => {
        const req = { query: { keyword: 'off' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.keyword, false);
    });

    it('disables dates flag from query string', () => {
        const req = { query: { dates: 'off' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.dates, false);
    });

    it('enables all three search flags together (hybrid + dates)', () => {
        const req = { query: { keyword: 'on', semantic: 'on', dates: 'on' }, session: {} };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.keyword, true);
        assert.equal(req.session.featureFlags.semantic, true);
        assert.equal(req.session.featureFlags.dates, true);
    });

    it('preserves existing feature flag values when the query string is absent', () => {
        const req = {
            query: {},
            session: {
                featureFlags: {
                    align: false,
                    keyword: true,
                    semantic: true,
                    dates: false
                }
            }
        };
        const res = { locals: {} };

        featureFlags(req, res, () => {});

        assert.equal(req.session.featureFlags.align, false);
        assert.equal(req.session.featureFlags.keyword, true);
        assert.equal(req.session.featureFlags.semantic, true);
        assert.equal(req.session.featureFlags.dates, false);
    });

    it('ignores invalid query-string values', () => {
        const req = {
            query: { keyword: 'maybe', semantic: 'sometimes' },
            session: {}
        };
        const res = { locals: {} };

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
        assert.equal(getFeatureFlagValue({ featureFlags: { align: false } }, 'align'), false);
        assert.equal(getFeatureFlagValue({ featureFlags: { keyword: false } }, 'keyword'), false);
        assert.equal(getFeatureFlagValue({ featureFlags: { semantic: true } }, 'semantic'), true);
        assert.equal(getFeatureFlagValue({ featureFlags: { dates: false } }, 'dates'), false);
    });

    it('falls back to defaults when the session value is missing', () => {
        assert.equal(getFeatureFlagValue({}, 'align'), true);
        assert.equal(getFeatureFlagValue({}, 'keyword'), true);
        assert.equal(getFeatureFlagValue({}, 'semantic'), false);
        assert.equal(getFeatureFlagValue({}, 'dates'), true);
    });

    it('falls back to the default for flags when the session value is not a boolean', () => {
        assert.equal(getFeatureFlagValue({ featureFlags: { keyword: 'hybrid' } }, 'keyword'), true);
        assert.equal(getFeatureFlagValue({ featureFlags: { semantic: 123 } }, 'semantic'), false);
        assert.equal(getFeatureFlagValue({ featureFlags: { dates: null } }, 'dates'), true);
    });
});
