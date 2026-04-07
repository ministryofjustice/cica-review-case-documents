import assert from 'node:assert/strict';
import test from 'node:test';
import notFoundHandler from './notFoundHandler.js';

const mockHtml = '<h1>404 Not Found</h1>';
const mockTemplateEngineService = {
    render: (template, context) => {
        assert.equal(template, 'page/404.njk');
        assert.deepEqual(context, {
            userName: 'test.user@example.com'
        });
        return mockHtml;
    }
};

test('notFoundHandler sends 404 and renders 404 page', async () => {
    const req = {
        session: {
            username: 'test.user@example.com'
        }
    };
    let statusCode, sentHtml;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        send(html) {
            sentHtml = html;
            return this;
        }
    };

    await notFoundHandler(req, res, () => {}, mockTemplateEngineService);

    assert.equal(statusCode, 404);
    assert.equal(sentHtml, mockHtml);
});
