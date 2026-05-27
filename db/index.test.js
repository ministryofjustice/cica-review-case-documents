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
            if (originalUrl === undefined) {
                delete process.env.APP_DATABASE_URL;
            } else {
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

        const dbQueryLog = logInfoSpy.mock.calls.find((call) => call.arguments[1] === 'DB QUERY');
        assert.ok(dbQueryLog);
        const [logData, logMessage] = dbQueryLog.arguments;
        assert.equal(logMessage, 'DB QUERY');
        assert.deepEqual(logData.data.query, queryObj);
        assert.equal(logData.data.rows, 2);
        assert.ok(logData.executionTime);
        assert.equal(typeof logData.executionTimeMs, 'number');
        assert.ok(logData.executionTimeMs >= 0);
        assert.ok(logData.executionTimeNs);
    });

    it('Should handle queries with no hits gracefully in logging', async () => {
        const fakeResults = { body: { hits: { hits: [] } } };
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

        const dbQueryLog = logInfoSpy.mock.calls.find((call) => call.arguments[1] === 'DB QUERY');
        assert.ok(dbQueryLog);
        const [logData] = dbQueryLog.arguments;
        assert.equal(logData.data.rows, 0);
    });

    it('Should reuse the same client instance for same Client and APP_DATABASE_URL', async () => {
        const originalUrl = process.env.APP_DATABASE_URL;
        process.env.APP_DATABASE_URL = 'http://reused-client-node';

        try {
            let constructorCallCount = 0;
            class FakeClient {
                constructor() {
                    constructorCallCount += 1;
                }

                search = async () => ({ body: { hits: { hits: [] } } });
            }

            const dbA = createDBQuery({ Client: FakeClient, logger: {} });
            const dbB = createDBQuery({ Client: FakeClient, logger: {} });

            await dbA.query({ index: 'test', query: { match_all: {} } });
            await dbB.query({ index: 'test', query: { match_all: {} } });

            assert.equal(constructorCallCount, 1);
        } finally {
            if (originalUrl === undefined) {
                delete process.env.APP_DATABASE_URL;
            } else {
                process.env.APP_DATABASE_URL = originalUrl;
            }
        }
    });

    it('Should emit slow query warning when execution exceeds threshold', async () => {
        const originalThreshold = process.env.DB_SLOW_QUERY_WARN_MS;
        process.env.DB_SLOW_QUERY_WARN_MS = '0';

        try {
            class FakeClient {
                search = async () => ({ body: { hits: { hits: [{ _id: 1 }] } } });
            }

            const warnSpy = mock.fn();
            const db = createDBQuery({
                Client: FakeClient,
                logger: {
                    info: mock.fn(),
                    warn: warnSpy
                }
            });

            await db.query({ index: 'test-index', query: { match_all: {} } });

            assert.equal(warnSpy.mock.callCount(), 1);
            const [warnData, warnMessage] = warnSpy.mock.calls[0].arguments;
            assert.equal(warnMessage, 'DB QUERY SLOW');
            assert.equal(warnData.index, 'test-index');
            assert.equal(warnData.slowQueryWarnMs, 0);
            assert.equal(typeof warnData.executionTimeMs, 'number');
            assert.ok(warnData.executionTimeMs >= 0);
        } finally {
            if (originalThreshold === undefined) {
                delete process.env.DB_SLOW_QUERY_WARN_MS;
            } else {
                process.env.DB_SLOW_QUERY_WARN_MS = originalThreshold;
            }
        }
    });
});
