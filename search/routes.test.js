import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { Writable } from 'stream';
import createLogger from '../middleware/logger/index.js';

import createDBQuery from '../db/index.js';

describe('search router', () => {
    let app
    let logStream;
    let lines = [];

    function LogCaptureStream() {
        return new Writable({
            write(chunk, encoding, callback) {
                try {
                    const parsed = JSON.parse(chunk.toString());
                    lines.push(parsed);
                } catch {
                    // ignore non-JSON chunks
                }
                callback();
            }
        });
    }

    beforeEach(async () => {
        const fakeResults = { hits: { hits: [{ _id: 1 }] } };
        const searchSpy = mock.fn(async () => fakeResults);
        class FakeClient {
            constructor() {}
            search = searchSpy;
        }
        const db = createDBQuery({
            Client: FakeClient
        });

        lines = [];

        const { default: importedApp } = await import('../app.js');
        app = importedApp({
            createLogger: () => (req, res, next) => {
                const fakeLogger = {
                    info: () => {},
                    child: () => fakeLogger
                };
                req.log = fakeLogger;
                next();
            }
        });
    });

    afterEach(() => {
        mock.reset();
        mock.restoreAll();
    });

    describe('/search', () => {
        describe('GET', () => {
            describe('No CRN in query parameters', () => {
                it('Should redirect to `/case`', async () => {
                    const response = await request(app).get('/search');
                    assert.equal(response.status, 302);
                    assert.match(response.text, /Found. Redirecting to \/case/);
                });
            });
            describe('CRN in query parameters', () => {
                it('Should render the search landing page', async () => {
                    const response = await request(app).get('/search?crn=25-123456');
                    assert.equal(response.status, 200);
                    assert.match(response.text, /<title>Search - CICA FIND - GOV.UK<\/title>/);
                });
                it('Should redirect to the search results page when no path parameter present', async () => {
                    const response = await request(app).get('/search/example?crn=25-123456');
                    assert.equal(response.status, 302);
                    assert.match(response.headers.location, /\/search\/example\/1\/5$/);
                });
                it('Should redirect to the search results page when pageNumber path parameter present', async () => {
                    const response = await request(app).get('/search/example/2?crn=25-123456');
                    assert.equal(response.status, 302);
                    assert.match(response.headers.location, /\/search\/example\/2\/5$/);
                });
            });
        });
    });
});
