import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { mock } from 'node:test';
import createApp from '../app.js';

let app;
let agent;

beforeEach(() => {
    // Use the actual app factory to build the test app
    app = createApp();
    agent = request.agent(app);
});

afterEach(() => {
    mock.reset();
});

test('GET /auth/login should render login page', async () => {
    const response = await agent.get('/auth/login');
    assert.strictEqual(response.status, 200);
    // Check for text that would be in your actual login.njk file
    assert.match(response.text, /Sign in/i);
});

test('POST /auth/login should redirect with error for missing credentials', async () => {
    // First, get a valid CSRF token
    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    // Now, send the POST request with the token but an empty body
    const response = await agent.post('/auth/login').send({ _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    assert.match(response.headers.location, /error=Enter%20your%20username%20and%20password/);
});

test('POST /auth/login should login successfully and redirect to "/" by default', async () => {
    // We need to get a valid CSRF token first
    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent.post('/auth/login').send({
        username: 'testuser',
        password: 'testPassword123',
        _csrf: csrfToken
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/');
});

test('POST /auth/login should redirect to returnTo URL after successful login', async () => {
    // First, visit a protected page to set the `returnTo` in the session
    await agent.get('/search?caseReferenceNumber=12345').expect(302);

    // Now, get the login page to grab the new CSRF token
    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    // Finally, log in
    const response = await agent.post('/auth/login').send({
        username: 'testuser',
        password: 'testPassword123',
        _csrf: csrfToken
    });

    assert.strictEqual(response.status, 302);
    // It should redirect to the original URL we tried to access
    assert.strictEqual(response.headers.location, '/search?caseReferenceNumber=12345');
});
