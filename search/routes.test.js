import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import createDBQuery from '../db/index.js';
import { caseSelected } from '../middleware/caseSelected/index.js'; // Add this import
import searchRouter from './routes.js';

/**
 * Creates an isolated Express application instance for testing the search routes.
 * Sets up JSON and URL-encoded body parsing, session management, and test-specific middleware.
 * Injects mock session data, CSRF token, CSP nonce, and logger into each request.
 * Mounts the search router at the '/search' path.
 *
 * @param {Object} [sessionData={}] - Optional session data to inject into each request's session.
 * @returns {import('express').Express} An Express application instance configured for isolated testing.
 */
function createIsolatedSearchApp(sessionData = {}) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
        session({
            secret: 'test',
            resave: false,
            saveUninitialized: true
        })
    );

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
    let _app;
    let db;

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
        _app = importedApp({
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
                // it('Should redirect to the search results page when no path parameter present', async () => {
                //     const app = createIsolatedSearchApp({
                //         caseSelected: true,
                //         caseReferenceNumber: '25-123456'
                //     });
                //     const response = await request(app).get('/search/?query=example&crn=25-123456');
                //     console.log(response.text);
                //     assert.equal(response.status, 302);
                //     assert.match(
                //         response.headers.location,
                //         /\/search\/?query=example&&crn=25-123456$/
                //     );
                // });
                // it('Should redirect to the search results page when pageNumber query parameter present', async () => {
                //     const app = createIsolatedSearchApp({
                //         caseSelected: true,
                //         caseReferenceNumber: '25-123456'
                //     });
                //     const response = await request(app).get(
                //         '/search/?query=example&crn=25-123456&pageNumber=2'
                //     );
                //     console.log(response.text);
                //     assert.equal(response.status, 302);
                //     assert.match(
                //         response.headers.location,
                //         /\/search\/?query=example&&crn=25-123456&pageNumber=2$/
                //     );
                // });
            });
        });
    });
});
