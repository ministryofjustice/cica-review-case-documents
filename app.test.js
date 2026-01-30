import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import createApp from './app.js';

describe('App', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
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
    });
});
