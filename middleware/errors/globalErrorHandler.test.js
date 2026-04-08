import assert from 'node:assert/strict';
import test from 'node:test';
import errorHandler from './globalErrorHandler.js';

const mockHtml = '<h1>Error Page</h1>';

/**
 * Test stub for the error page renderer.
 *
 * @param {string} template Template path that should match the error page view.
 * @param {{ error: string }} pageData Error payload passed to the template renderer.
 * @param {{ session?: { username?: string } }} req Request object containing session data.
 * @param {{ locals?: { csrfToken?: string } }} res Response object containing locals such as CSRF token.
 * @returns {string} Mock HTML returned by the renderer.
 */
function stubRenderHtml(template, pageData, req, res) {
    assert.equal(template, 'page/error.njk');
    assert.deepEqual(pageData, { error: 'Sorry, there is a problem with the service.' });
    assert.equal(req.session?.username, 'test.user@example.com');
    assert.equal(res.locals?.csrfToken, 'csrf-token');
    return mockHtml;
}

test('errorHandler logs error and sends error page', async () => {
    const err = new Error('Test error');
    err.status = 500;
    let logged = false;
    const req = {
        session: {
            username: 'test.user@example.com'
        },
        log: {
            error: ({ err: loggedErr, status }, msg) => {
                logged = true;
                assert.equal(loggedErr, err);
                assert.equal(status, 500);
                assert.equal(msg, 'Application Error');
            }
        }
    };
    let statusCode, sentHtml;
    const res = {
        headersSent: false,
        locals: {
            csrfToken: 'csrf-token'
        },
        status(code) {
            statusCode = code;
            return this;
        },
        send(html) {
            sentHtml = html;
            return this;
        }
    };
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };

    await errorHandler(err, req, res, next, stubRenderHtml);

    assert.ok(logged);
    assert.equal(statusCode, 500);
    assert.equal(sentHtml, mockHtml);
    assert.equal(nextCalled, false);
});

test('errorHandler calls next if headersSent', async () => {
    const err = new Error('Test error');
    const req = { log: { error: () => {} } };
    const res = { headersSent: true };
    let nextCalled = false;
    const next = (e) => {
        nextCalled = true;
        assert.equal(e, err);
    };

    await errorHandler(err, req, res, next, stubRenderHtml);

    assert.ok(nextCalled);
});
