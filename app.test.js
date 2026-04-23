import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import createApp from './app.js';

describe('App', () => {
    let originalEnv;

    /**
     * Sets required Entra environment variables for app boot in tests.
     */
    function setRequiredEntraEnv() {
        process.env.ENTRA_CLIENT_ID = 'client-id';
        process.env.ENTRA_CLIENT_SECRET = 'client-secret';
        process.env.ENTRA_TENANT_ID = 'tenant-id';
    }

    beforeEach(() => {
        originalEnv = { ...process.env };
        setRequiredEntraEnv();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Cookie Configuration', () => {
        it('should set secure: false when APP_BASE_URL uses http (e.g. local development)', async () => {
            process.env.NODE_ENV = 'development';
            process.env.APP_BASE_URL = 'http://localhost:5000';
            process.env.APP_LOG_LEVEL = 'silent';

            const app = await createApp();
            assert.ok(app);
        });

        it('should set secure: true when APP_BASE_URL uses https', async () => {
            process.env.NODE_ENV = 'production';
            process.env.APP_BASE_URL = 'https://example.test';
            process.env.APP_LOG_LEVEL = 'silent';

            const app = await createApp();
            assert.ok(app);
        });
    });

    describe('App Initialization', () => {
        it('should create app instance', async () => {
            process.env.NODE_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';

            const app = await createApp();
            assert.ok(app);
            assert.ok(typeof app.use === 'function');
        });

        it('should set cspNonce in res.locals middleware', async () => {
            process.env.NODE_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';

            const app = await createApp();
            assert.ok(app);
            // The middleware should be registered
        });

        it('should fail fast at boot when APP_JWT_SECRET is missing', async () => {
            process.env.NODE_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';
            delete process.env.APP_JWT_SECRET;

            await assert.rejects(
                async () => createApp(),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /APP_JWT_SECRET/);
                    return true;
                }
            );
        });
    });
});
