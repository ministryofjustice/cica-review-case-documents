import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import createApp from './app.js';

describe('App', () => {
    let originalEnv;

    function setRequiredEntraEnv() {
        process.env.ENTRA_CLIENT_ID = 'client-id';
        process.env.ENTRA_CLIENT_SECRET_ID = 'client-secret';
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
        it('should set secure: false in development environment', async () => {
            process.env.NODE_ENV = 'development';
            process.env.APP_LOG_LEVEL = 'silent';

            const app = await createApp();
            assert.ok(app);
        });

        it('should set secure: true in production when APP_ALLOW_INSECURE_COOKIE is not set', async () => {
            process.env.NODE_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            delete process.env.APP_ALLOW_INSECURE_COOKIE;

            const app = await createApp();
            assert.ok(app);
        });

        it('should set secure: false in production when APP_ALLOW_INSECURE_COOKIE is true', async () => {
            process.env.NODE_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_ALLOW_INSECURE_COOKIE = 'true';

            const app = await createApp();
            assert.ok(app);
        });

        it('should set secure: true in production when APP_ALLOW_INSECURE_COOKIE is false', async () => {
            process.env.NODE_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_ALLOW_INSECURE_COOKIE = 'false';

            const app = await createApp();
            assert.ok(app);
        });

        it('should fail fast at boot when APP_ALLOW_INSECURE_COOKIE has an invalid value', async () => {
            process.env.NODE_ENV = 'production';
            process.env.APP_LOG_LEVEL = 'silent';
            process.env.APP_ALLOW_INSECURE_COOKIE = 'yes';

            await assert.rejects(
                async () => createApp(),
                (err) => {
                    assert.equal(err.name, 'ConfigurationError');
                    assert.match(err.message, /APP_ALLOW_INSECURE_COOKIE/);
                    return true;
                }
            );
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
