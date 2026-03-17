import assert from 'node:assert';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import createApp from '../app.js';

let app;
let agent;

beforeEach(async () => {
    process.env.ENTRA_CLIENT_ID = 'client-id';
    process.env.ENTRA_CLIENT_SECRET_ID = 'client-secret';
    delete process.env.ENTRA_CLIENT_SECRET;
    process.env.ENTRA_TENANT_ID = 'tenant-id';
    delete process.env.ENTRA_SCOPE;
    delete process.env.ENTRA_INTERACTIVE_FALLBACK;

    app = await createApp({
        createLogger: () => (req, res, next) => {
            req.log = {
                error: () => {},
                info: () => {},
                warn: () => {},
                debug: () => {},
                child: () => req.log
            };
            next();
        }
    });
    agent = request.agent(app);
});

test('GET /auth/login with Entra configured should request silent sign-in', async () => {
    const response = await agent.get('/auth/login');

    assert.strictEqual(response.status, 302);
    assert.match(
        response.headers.location,
        /^https:\/\/login\.microsoftonline\.com\/tenant-id\/oauth2\/v2\.0\/authorize\?/
    );
    assert.match(response.headers.location, /prompt=none/);
});

test('GET /auth/callback with login_required should fallback to interactive by default', async () => {
    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'login_required',
        error_description: 'Silent sign-in required interaction'
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/auth/login?interactive=1');
});

test('GET /auth/callback with login_required should fail when interactive fallback is disabled', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'false';

    await agent.get('/auth/login').expect(302);

    const response = await agent.get('/auth/callback').query({
        error: 'login_required',
        error_description: 'Silent sign-in required interaction'
    });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Authentication failed/);
});

test('GET /auth/login?interactive=1 should skip prompt=none when fallback is enabled', async () => {
    process.env.ENTRA_INTERACTIVE_FALLBACK = 'true';

    const response = await agent.get('/auth/login').query({ interactive: '1' });

    assert.strictEqual(response.status, 302);
    assert.doesNotMatch(response.headers.location, /prompt=none/);
});

test('GET /auth/sign-out displays sign out message without active session', async () => {
    const response = await agent.get('/auth/sign-out');

    assert.strictEqual(response.status, 200);
    assert.match(response.text, /You have signed out/);
});
