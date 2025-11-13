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
});
