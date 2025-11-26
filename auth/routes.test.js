/**
 * Test suite for authentication routes in the application.
 *
 * Uses `node:test` for test structure and `supertest` for HTTP assertions.
 * Covers the following scenarios:
 * - Rendering the login page.
 * - Handling missing username and/or password on login.
 * - Handling invalid credentials and email formats.
 * - Successful login and redirection logic.
 * - Sign-out flow and session/case reference handling.
 * - Graceful handling of JWT signing errors.
 *
 * Helper Functions:
 * @function getCsrfToken
 * @description Retrieves CSRF token from the login page for use in POST requests.
 * @param {Object} agent - Supertest agent instance.
 * @returns {Promise<string>} - Extracted CSRF token.
 *
 * Test Environment Setup:
 * - Mocks logger to avoid side effects.
 * - Sets up environment variables for authentication.
 * - Uses Supertest agent to maintain session state across requests.
 *
 * Each test case:
 * - Asserts correct HTTP status codes.
 * - Asserts expected content in response bodies.
 * - Ensures session and redirection logic works as intended.
 * - Handles error scenarios, including server errors.
 */
import { test, beforeEach } from 'node:test'; // Removed 'afterEach' and 'mock'
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';

let app;
let agent;

/**
 * Retrieves the CSRF token from the login page using the provided SuperTest agent.
 *
 * @param {import('supertest').SuperAgentTest} agent - The SuperTest agent to perform the GET request.
 * @returns {Promise<string>} The extracted CSRF token from the login page.
 */
async function getCsrfToken(agent) {
    const res = await agent.get('/auth/login');
    return res.text.match(/name="_csrf" value="([^"]+)"/)[1];
}

beforeEach(() => {
    app = createApp({
        createLogger: () => (req, res, next) => {
            req.log = {
                error: () => {},
                info: () => {},
                warn: () => {},
                debug: () => {},
                child: () => req.log // Add this line
            };
            next();
        }
    });
    agent = request.agent(app);
});

test('GET /auth/login should render login page', async () => {
    const response = await agent.get('/auth/login');
    assert.strictEqual(response.status, 200);
    assert.match(response.text, /Sign in/i);
});

test('POST /auth/login with no username and no password shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    const response = await agent.post('/auth/login').send({ _csrf: csrfToken });

    assert.strictEqual(response.status, 400);
    assert.match(response.text, /Enter your username/);
    assert.match(response.text, /Enter your password/);
});

test('POST /auth/login with no username shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
        .post('/auth/login')
        .send({ password: 'testPassword123', _csrf: csrfToken });

    assert.strictEqual(response.status, 400);
    assert.match(response.text, /Enter your username/);
    assert.doesNotMatch(response.text, /Enter your password/);
});

test('POST /auth/login with no password shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
        .post('/auth/login')
        .send({ username: 'testuser', _csrf: csrfToken });

    assert.strictEqual(response.status, 400);
    assert.match(response.text, /Enter your password/);
    assert.doesNotMatch(response.text, /Enter your username/);
    assert.match(response.text, /testuser/);
});

test('POST /auth/login with invalid credentials shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
        .post('/auth/login')
        .send({ username: 'wronguser', password: 'wrongPassword', _csrf: csrfToken });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Enter a valid username and password/);
    assert.match(response.text, /wronguser/);
});

test('POST /auth/login with invalid email format shows correct errors', async () => {
    process.env.AUTH_USERNAMES = 'valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
        .post('/auth/login')
        .send({ username: 'not-an-email', password: 'DemoPass123', _csrf: csrfToken });

    assert.strictEqual(response.status, 401);
    assert.match(response.text, /Enter a valid username and password/);
    assert.match(response.text, /not-an-email/);
});

test('POST /auth/login should login successfully and redirect to "/" by default', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com,valid.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

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

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
        .post('/auth/login')
        .send({ username: 'test.user@example.com', password: 'DemoPass123', _csrf: csrfToken });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, '/search?caseReferenceNumber=12345');
});

test('GET /auth/sign-out displays sign out message and case reference link', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    // Log in to create a session
    const csrfToken = await getCsrfToken(agent);
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

test('POST /auth/login handles JWT signing errors gracefully (500)', async () => {
    process.env.AUTH_USERNAMES = 'test.user@example.com';
    process.env.AUTH_SECRET_PASSWORD = 'DemoPass123';

    const csrfToken = await getCsrfToken(agent);

    // 1. Save original method
    const originalSign = jwt.sign;

    // 2. Manually mock the method
    jwt.sign = () => {
        throw new Error('Simulated JWT Signing Error');
    };

    try {
        const response = await agent
            .post('/auth/login')
            .send({ username: 'test.user@example.com', password: 'DemoPass123', _csrf: csrfToken });

        // Expect a 500 status code (Internal Server Error)
        assert.strictEqual(response.status, 500);

        // Expect the generic error page content (from error.njk)
        assert.match(response.text, /Sorry, there is a problem with the service/);
    } finally {
        // 3. Restore original method (Critical!)
        jwt.sign = originalSign;
    }
});
