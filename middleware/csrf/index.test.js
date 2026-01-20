import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import createCsrf from './index.js';

describe('csrf module', () => {
    it('calls doubleCsrf with correct config in development', () => {
        process.env.NODE_ENV = 'development';
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            };
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
            };
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

    it('getSecret throws ConfigurationError when APP_COOKIE_SECRET is undefined', () => {
        const originalSecret = process.env.APP_COOKIE_SECRET;
        delete process.env.APP_COOKIE_SECRET;

        try {
            const doubleCsrfSpy = mock.fn(() => {
                return {
                    doubleCsrfProtection: mock.fn(),
                    generateCsrfToken: mock.fn()
                };
            });

            createCsrf(doubleCsrfSpy);

            const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;

            assert.throws(() => callArgs.getSecret(), {
                name: 'ConfigurationError',
                message: 'Environment variable "APP_COOKIE_SECRET" must be set'
            });
        } finally {
            if (originalSecret) {
                process.env.APP_COOKIE_SECRET = originalSecret;
            }
        }
    });

    it('getSecret returns APP_COOKIE_SECRET when defined', () => {
        const originalSecret = process.env.APP_COOKIE_SECRET;
        process.env.APP_COOKIE_SECRET = 'test-secret-key';

        try {
            const doubleCsrfSpy = mock.fn(() => {
                return {
                    doubleCsrfProtection: mock.fn(),
                    generateCsrfToken: mock.fn()
                };
            });

            createCsrf(doubleCsrfSpy);

            const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;
            assert.equal(callArgs.getSecret(), 'test-secret-key');
        } finally {
            if (originalSecret) {
                process.env.APP_COOKIE_SECRET = originalSecret;
            } else {
                delete process.env.APP_COOKIE_SECRET;
            }
        }
    });

    it('getSessionIdentifier throws ConfigurationError when session is missing', () => {
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            };
        });

        createCsrf(doubleCsrfSpy);

        const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;

        assert.throws(() => callArgs.getSessionIdentifier({}), {
            name: 'ConfigurationError',
            message: 'Session is missing or invalid. CSRF protection requires a valid session'
        });
    });

    it('getSessionIdentifier throws ConfigurationError when session.id is missing', () => {
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            };
        });

        createCsrf(doubleCsrfSpy);

        const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;

        assert.throws(() => callArgs.getSessionIdentifier({ session: {} }), {
            name: 'ConfigurationError',
            message: 'Session is missing or invalid. CSRF protection requires a valid session'
        });
    });

    it('getSessionIdentifier returns session.id when valid', () => {
        const doubleCsrfSpy = mock.fn(() => {
            return {
                doubleCsrfProtection: mock.fn(),
                generateCsrfToken: mock.fn()
            };
        });

        createCsrf(doubleCsrfSpy);

        const [callArgs] = doubleCsrfSpy.mock.calls[0].arguments;
        const req = { session: { id: 'test-session-id-123' } };

        assert.equal(callArgs.getSessionIdentifier(req), 'test-session-id-123');
    });
});
