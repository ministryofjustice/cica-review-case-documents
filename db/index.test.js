import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import createDBQuery from './index.js';

describe('DB Service', () => {
    afterEach(() => {
        mock.reset();
        mock.restoreAll();
    });

    it('Should call search with the correct query', async () => {
        const searchSpy = mock.fn(async () => ({ hits: { hits: [] } }));

        class FakeClient {
            search = searchSpy;
        }
        const fakeLogger = mock.fn(() => {});

        const db = createDBQuery({
            Client: FakeClient,
            logger: fakeLogger
        });
        const queryObj = { index: 'test', query: { match_all: {} } };

        await db.query(queryObj);

        assert.equal(searchSpy.mock.callCount(), 1);
        const [callArg] = searchSpy.mock.calls[0].arguments;
        assert.deepEqual(callArg, queryObj);
    });

    it('Should return search results', async () => {
        const fakeResults = { hits: { hits: [{ _id: 1 }] } };
        const searchSpy = mock.fn(async () => fakeResults);

        class FakeClient {
            search = searchSpy;
        }
        const fakeLogger = mock.fn(() => {});

        const db = createDBQuery({
            Client: FakeClient,
            logger: fakeLogger
        });
        const results = await db.query({ index: 'test', query: { match_all: {} } });

        assert.deepEqual(results, fakeResults);
    });

    it('Should propagate search errors', async () => {
        const fakeError = new Error('Search failed');
        const searchSpy = mock.fn(async () => {
            throw fakeError;
        });

        class FakeClient {
            search = searchSpy;
        }
        const fakeLogger = mock.fn(() => {});

        const db = createDBQuery({
            Client: FakeClient,
            logger: fakeLogger
        });

        let caughtError;
        try {
            await db.query({ index: 'test', query: { match_all: {} } });
        } catch (err) {
            caughtError = err;
        }

        assert.equal(caughtError, fakeError);
    });

    it('Should throw ConfigurationError when APP_DATABASE_URL is undefined', () => {
        const originalUrl = process.env.APP_DATABASE_URL;
        delete process.env.APP_DATABASE_URL;

        try {
            assert.throws(
                () => {
                    createDBQuery({ logger: {} });
                },
                {
                    name: 'ConfigurationError',
                    message: 'Environment variable "APP_DATABASE_URL" must be set'
                }
            );
        } finally {
            if (originalUrl) {
                process.env.APP_DATABASE_URL = originalUrl;
            }
        }
    });

    it('Should log query execution with timing information when logger.info exists', async () => {
        const fakeResults = { hits: { hits: [{ _id: 1 }, { _id: 2 }] } };
        const searchSpy = mock.fn(async () => fakeResults);

        class FakeClient {
            search = searchSpy;
        }

        const logInfoSpy = mock.fn();
        const fakeLogger = {
            info: logInfoSpy
        };

        const db = createDBQuery({
            Client: FakeClient,
            logger: fakeLogger
        });

        const queryObj = { index: 'test', query: { match_all: {} } };
        await db.query(queryObj);

        assert.equal(logInfoSpy.mock.callCount(), 1);
        const [logData, logMessage] = logInfoSpy.mock.calls[0].arguments;
        assert.equal(logMessage, 'DB QUERY');
        assert.deepEqual(logData.data.query, queryObj);
        assert.equal(logData.data.rows, 2);
        assert.ok(logData.executionTime);
        assert.ok(logData.executionTimeNs);
    });

    it('Should handle queries with no hits gracefully in logging', async () => {
        const fakeResults = { hits: {} };
        const searchSpy = mock.fn(async () => fakeResults);

        class FakeClient {
            search = searchSpy;
        }

        const logInfoSpy = mock.fn();
        const fakeLogger = {
            info: logInfoSpy
        };

        const db = createDBQuery({
            Client: FakeClient,
            logger: fakeLogger
        });

        await db.query({ index: 'test', query: {} });

        const [logData] = logInfoSpy.mock.calls[0].arguments;
        assert.equal(logData.data.rows, 0);
    });
});
