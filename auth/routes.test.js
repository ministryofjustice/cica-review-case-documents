import assert from 'node:assert';
import { beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import createApp from '../app.js';
import { createLoginHandler } from './routes.js';

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

beforeEach(async () => {
    app = await createApp({
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

test('GET /auth/login should call next with error when render throws', () => {
    const renderError = new Error('Render failed');
    const handler = createLoginHandler(() => ({
        render: () => {
            throw renderError;
        }
    }));

    const req = {};
    const res = {
        locals: { csrfToken: 'csrf-token' },
        send: () => {
            throw new Error('send should not be called when render throws');
        }
    };

    let nextError;
    const next = (err) => {
        nextError = err;
    };

    handler(req, res, next);

    assert.strictEqual(nextError, renderError);
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
    await agent.get('/search?caseReferenceNumber=25-711111');

    // Sign out
    const response = await agent.get('/auth/sign-out');
    assert.strictEqual(response.status, 200);
    assert.match(response.text, /You have signed out/);
    assert.match(response.text, /Sign in/);
    assert.match(response.text, /25-711111/);
    assert.match(response.text, /href="\/search\?caseReferenceNumber=25-711111"/);
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
