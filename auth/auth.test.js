import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { mock } from 'node:test';
import createApp from '../app.js';

let app;
let agent;

function extractParams(res) {
    const loc = res.headers.location;
    const url = new URL('http://local' + loc); // prefix with dummy origin
    return {
        location: loc,
        params: Object.fromEntries(url.searchParams.entries())
    };
}

beforeEach(() => {
    app = createApp();
    agent = request.agent(app);
});

afterEach(() => {
    mock.reset();
});

test('GET /auth/login should render login page', async () => {
    const response = await agent.get('/auth/login');
    assert.strictEqual(response.status, 200);
    assert.match(response.text, /Sign in/i);
});

test('POST /auth/login with no username and no password shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent.post('/auth/login').send({ _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    const { params } = extractParams(response);
    assert.equal(params.error, 'Enter your username');
    assert.equal(params.usernameError, 'Enter your username');
    assert.equal(params.passwordError, 'Enter your password');
});

test('POST /auth/login with no username shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ password: 'testPassword123', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    const { params } = extractParams(response);
    assert.equal(params.error, 'Enter your username');
    assert.equal(params.usernameError, 'Enter your username');
    assert.ok(!('passwordError' in params));
});

test('POST /auth/login with no password shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ username: 'testuser', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    const { params } = extractParams(response);
    assert.equal(params.error, 'Enter your password');
    assert.equal(params.passwordError, 'Enter your password');
    assert.ok(!('usernameError' in params));
    assert.equal(params.username, 'testuser');
});

test('POST /auth/login with invalid credentials shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ username: 'wronguser', password: 'wrongPassword', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    const { params } = extractParams(response);
    assert.equal(params.error, 'Enter a valid username and password');
    assert.equal(params.usernameError, 'Enter a valid username and password');
    assert.ok(!('passwordError' in params));
    assert.equal(params.username, 'wronguser');
});

test('POST /auth/login with invalid email format shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ username: 'not-an-email', password: 'DemoPass123', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    const { params } = extractParams(response);
    assert.equal(params.error, 'Enter a valid username and password');
    assert.equal(params.usernameError, 'Enter a valid username and password');
    assert.ok(!('passwordError' in params));
    assert.equal(params.username, 'not-an-email');
});

test('POST /auth/login should login successfully and redirect to "/" by default', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ username: 'test.user@example.com', password: 'DemoPass123', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/');
});

test('POST /auth/login should redirect to returnTo URL after successful login', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    // Visit protected route to set returnTo
    await agent.get('/search?caseReferenceNumber=12345').expect(302);

    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];

    const response = await agent
        .post('/auth/login')
        .send({ username: 'test.user@example.com', password: 'DemoPass123', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/search?caseReferenceNumber=12345');
});

test('GET /auth/sign-out displays sign out message and case reference link', async () => {
    // Set up session with a caseReferenceNumber
    process.env.AUTH_USERNAMES = 'test.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    // Log in to create a session
    const getRes = await agent.get('/auth/login');
    const csrfToken = getRes.text.match(/name="_csrf" value="([^"]+)"/)[1];
    await agent
        .post('/auth/login')
        .send({ username: 'test.user@example.com', password: 'DemoPass123', _csrf: csrfToken });

    // Set the caseReferenceNumber in session by visiting a route that sets it
    await agent.get('/search?caseReferenceNumber=25-111111');

    // Sign out
    const response = await agent.get('/auth/sign-out');
    assert.strictEqual(response.status, 200);
    assert.match(response.text, /You have signed out/);
    assert.match(response.text, /Sign in/);
    assert.match(response.text, /25-111111/);
    assert.match(response.text, /href="\/search\?caseReferenceNumber=25-111111"/);
});
