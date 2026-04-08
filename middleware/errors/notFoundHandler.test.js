import assert from 'node:assert/strict';
import test from 'node:test';
import notFoundHandler from './notFoundHandler.js';

const mockHtml = '<h1>404 Not Found</h1>';
/**
 * Test stub for the not-found page renderer.
 *
 * @param {string} template Template path that should match the 404 page view.
 * @param {Record<string, never>} pageData Page data passed to the template renderer.
 * @param {{ session?: { username?: string } }} req Request object containing session data.
 * @param {{ locals?: { csrfToken?: string } }} res Response object containing locals such as CSRF token.
 * @returns {string} Mock HTML returned by the renderer.
 */
function stubRenderHtml(template, pageData, req, res) {
    assert.equal(template, 'page/404.njk');
    assert.deepEqual(pageData, {});
    assert.equal(req.session?.username, 'test.user@example.com');
    assert.equal(res.locals?.csrfToken, 'csrf-token');
    return mockHtml;
}

test('notFoundHandler sends 404 and renders 404 page', async () => {
    const req = {
        session: {
            username: 'test.user@example.com'
        }
    };
    let statusCode, sentHtml;
    const res = {
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

    await notFoundHandler(req, res, () => {}, stubRenderHtml);

    assert.equal(statusCode, 404);
    assert.equal(sentHtml, mockHtml);
});
