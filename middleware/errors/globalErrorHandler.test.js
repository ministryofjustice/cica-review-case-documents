import assert from 'node:assert/strict';
import test from 'node:test';
import errorHandler from './globalErrorHandler.js';

const mockHtml = '<h1>Error Page</h1>';
const mockTemplateEngineService = {
    render: (template, context) => {
        assert.equal(template, 'page/error.njk');
        assert.deepEqual(context, { error: 'Sorry, there is a problem with the service.' });
        return mockHtml;
    }
};

test('errorHandler logs error and sends error page', async () => {
    const err = new Error('Test error');
    err.status = 500;
    let logged = false;
    const req = {
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

    await errorHandler(err, req, res, next, mockTemplateEngineService);

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

    await errorHandler(err, req, res, next, mockTemplateEngineService);

    assert.ok(nextCalled);
});
