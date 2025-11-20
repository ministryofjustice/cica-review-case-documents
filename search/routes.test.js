import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import request from 'supertest';
import { Writable } from 'stream';
import createDBQuery from '../db/index.js';

import express from 'express';
import session from 'express-session';
import searchRouter from './routes.js';
import { caseSelected } from '../middleware/caseSelected/index.js'; // Add this import

function createIsolatedSearchApp(sessionData = {}) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        secret: 'test',
        resave: false,
        saveUninitialized: true
    }));

    app.use((req, res, next) => {
        Object.assign(req.session, sessionData);
        res.locals.csrfToken = 'test-csrf';
        res.locals.cspNonce = 'test-nonce';
        req.log = { info: () => {}, child: () => ({}) };
        next();
    });

    app.use('/search', caseSelected, searchRouter);
    return app;
}

describe('search router', () => {
    let app;
    let db;
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
            search = searchSpy;
        }
        db = createDBQuery({
            Client: FakeClient
        });

        const { default: importedApp } = await import('../app.js');
        app = importedApp({
            db,
            createLogger: () => (req, res, next) => {
                const fakeLogger = {
                    info: () => {},
                    child: () => fakeLogger
                };
                req.log = fakeLogger;
                next();
            },
            authMiddleware: (req, res, next) => {
                req.session = { 
                    user: { id: 1 },
                    passport: { user: { id: 1 } }
                };
                req.isAuthenticated = () => true;
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
                    const isolatedApp = createIsolatedSearchApp({
                        caseSelected: false
                    });
                    const response = await request(isolatedApp).get('/search');
                    assert.equal(response.status, 302);
                    assert.match(response.text, /Found. Redirecting to \/case/);
                });
            });
            describe('CRN in query parameters', () => {
                it('Should render the search landing page', async () => {
                    const app = createIsolatedSearchApp({
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    });
                    const response = await request(app).get('/search?crn=25-123456');
                    assert.equal(response.status, 200);
                    assert.match(response.text, /<title>Search - CICA FIND - GOV.UK<\/title>/);
                });
                it('Should redirect to the search results page when no path parameter present', async () => {
                    const app = createIsolatedSearchApp({
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    });
                    const response = await request(app).get('/search/example?crn=25-123456');
                    assert.equal(response.status, 302);
                    assert.match(response.headers.location, /\/search\/example\/1\/5$/);
                });
                it('Should redirect to the search results page when pageNumber path parameter present', async () => {
                    const app = createIsolatedSearchApp({
                        caseSelected: true,
                        caseReferenceNumber: '25-123456'
                    });
                    const response = await request(app).get('/search/example/2?crn=25-123456');
                    assert.equal(response.status, 302);
                    assert.match(response.headers.location, /\/search\/example\/2\/5$/);
                });
            });
        });
    });
});

// describe('search router (isolated)', () => {
//     it('Should render the search landing page', async () => {
//         const app = createIsolatedSearchApp({
//             caseSelected: true,
//             caseReferenceNumber: '25-123456'
//         });
//         const response = await request(app).get('/search');
//         assert.equal(response.status, 200);
//         assert.match(response.text, /<title>Search - CICA FIND - GOV.UK<\/title>/);
//     });

//     // Add more isolated tests as needed...
// });
