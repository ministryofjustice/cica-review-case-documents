import createCsrf from './index.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('csrf module', () => {
    it('calls doubleCsrf with correct config in development', () => {
        process.env.NODE_ENV = 'development';
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            }
        });

        createCsrf(doubleCsrfSpy);

        assert.equal(doubleCsrfSpy.mock.callCount(), 1);
        const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;
        assert.equal(typeof callArgs.getSecret, 'function');
        assert.equal(typeof callArgs.getCsrfTokenFromRequest, 'function');
        assert.deepEqual(callArgs.cookieName, 'request-config');
        assert.deepEqual(callArgs.cookieOptions, {
            path: '/',
            secure: false,
            httpOnly: true,
            sameSite: 'Lax'
        });
    });

    it('calls doubleCsrf with correct config in production', () => {
        process.env.NODE_ENV = 'production';
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            }
        });

        createCsrf(doubleCsrfSpy);

        assert.equal(doubleCsrfSpy.mock.callCount(), 1);
        const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;
        assert.equal(typeof callArgs.getSecret, 'function');
        assert.equal(typeof callArgs.getCsrfTokenFromRequest, 'function');
        assert.deepEqual(callArgs.cookieName, '__Host-request-config');
        assert.deepEqual(callArgs.cookieOptions, {
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax'
        });
    });
});
