import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    getEntraErrorCode,
    getSessionValuesToPreserve,
    getSingleNonEmptyQueryParam,
    regenerateSession,
    SESSION_KEYS_TO_PRESERVE_ON_AUTH_REGENERATION
} from './auth-flow-helpers.js';

describe('auth-flow-helpers', () => {
    it('SESSION_KEYS_TO_PRESERVE_ON_AUTH_REGENERATION contains exactly the expected keys', () => {
        assert.deepEqual(SESSION_KEYS_TO_PRESERVE_ON_AUTH_REGENERATION, [
            'returnTo',
            'caseSelected',
            'caseReferenceNumber'
        ]);
    });

    describe('getSingleNonEmptyQueryParam', () => {
        it('returns the original string when value is a non-empty string', () => {
            assert.equal(getSingleNonEmptyQueryParam('state-123'), 'state-123');
        });

        it('returns undefined for empty or whitespace-only strings', () => {
            assert.equal(getSingleNonEmptyQueryParam(''), undefined);
            assert.equal(getSingleNonEmptyQueryParam('   '), undefined);
        });

        it('returns undefined for non-string values and arrays', () => {
            assert.equal(getSingleNonEmptyQueryParam(undefined), undefined);
            assert.equal(getSingleNonEmptyQueryParam(null), undefined);
            assert.equal(getSingleNonEmptyQueryParam(123), undefined);
            assert.equal(getSingleNonEmptyQueryParam(['state-1', 'state-2']), undefined);
        });
    });

    describe('getEntraErrorCode', () => {
        it('extracts AADSTS error code when present', () => {
            const description = 'AADSTS50058: User session missing';
            assert.equal(getEntraErrorCode(description), 'AADSTS50058');
        });

        it('returns undefined when no AADSTS code exists', () => {
            assert.equal(getEntraErrorCode('Something else failed'), undefined);
            assert.equal(getEntraErrorCode(undefined), undefined);
        });
    });

    describe('getSessionValuesToPreserve', () => {
        it('preserves only allowed session keys with defined values', () => {
            const session = {
                returnTo: '/search?query=abc',
                caseSelected: true,
                caseReferenceNumber: '12-123456',
                username: 'ignored-user',
                entraAuth: { state: 'state-1' }
            };

            assert.deepEqual(getSessionValuesToPreserve(session), {
                returnTo: '/search?query=abc',
                caseSelected: true,
                caseReferenceNumber: '12-123456'
            });
        });

        it('omits allowed keys whose value is undefined', () => {
            const session = {
                returnTo: undefined,
                caseSelected: true,
                caseReferenceNumber: undefined
            };

            assert.deepEqual(getSessionValuesToPreserve(session), {
                caseSelected: true
            });
        });

        it('returns empty object when session is missing', () => {
            assert.deepEqual(getSessionValuesToPreserve(undefined), {});
        });
    });

    describe('regenerateSession', () => {
        it('resolves when req.session.regenerate succeeds', async () => {
            const req = {
                session: {
                    regenerate: (callback) => callback()
                }
            };

            await assert.doesNotReject(() => regenerateSession(req));
        });

        it('rejects when req.session.regenerate fails', async () => {
            const expectedError = new Error('session-regenerate-failed');
            const req = {
                session: {
                    regenerate: (callback) => callback(expectedError)
                }
            };

            await assert.rejects(() => regenerateSession(req), /session-regenerate-failed/);
        });
    });
});
