import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import createSavedSearchStore from './saved-search-store.js';

describe('saved-search-store', () => {
    const originalDbUrl = process.env.APP_DATABASE_URL;

    beforeEach(() => {
        process.env.APP_DATABASE_URL = 'http://localhost:9200';
    });

    afterEach(() => {
        if (originalDbUrl === undefined) {
            delete process.env.APP_DATABASE_URL;
        } else {
            process.env.APP_DATABASE_URL = originalDbUrl;
        }
    });

    it('throws a configuration error when APP_DATABASE_URL is missing', () => {
        delete process.env.APP_DATABASE_URL;

        assert.throws(
            () => createSavedSearchStore({}),
            (error) => {
                assert.equal(error.name, 'ConfigurationError');
                assert.match(error.message, /APP_DATABASE_URL/);
                return true;
            }
        );
    });

    it('creates a saved search and returns id + expiry', async () => {
        let indexArgs;

        class FakeClient {
            index = async (args) => {
                indexArgs = args;
                return { body: { result: 'created' } };
            };

            get = async () => ({ body: { _source: {} } });
            delete = async () => ({ body: { result: 'deleted' } });
        }

        const store = createSavedSearchStore({
            Client: FakeClient,
            now: () => new Date('2026-06-30T12:00:00.000Z')
        });

        const result = await store.create({
            query: 'john smith',
            searchType: 'semantic',
            caseReferenceNumber: '25-711111',
            itemsPerPage: 10,
            ownerUserName: 'user@example.com',
            ttlDays: 30
        });

        assert.match(result.id, /^srch_/);
        assert.equal(result.expiresAt, '2026-07-30T12:00:00.000Z');
        assert.equal(indexArgs.index, 'saved_searches');
        assert.equal(indexArgs.body.query, 'john smith');
        assert.equal(indexArgs.body.searchType, 'semantic');
        assert.equal(indexArgs.body.caseReferenceNumber, '25-711111');
    });

    it('returns null when saved search is not found', async () => {
        class FakeClient {
            index = async () => ({ body: { result: 'created' } });

            get = async () => {
                const error = new Error('not found');
                error.meta = { statusCode: 404 };
                throw error;
            };

            delete = async () => ({ body: { result: 'deleted' } });
        }

        const store = createSavedSearchStore({ Client: FakeClient });
        const result = await store.getById('srch_abc');
        assert.equal(result, null);
    });

    it('deletes existing saved search and ignores 404 on delete', async () => {
        let deleteCalls = 0;

        class FakeClient {
            index = async () => ({ body: { result: 'created' } });
            get = async () => ({ body: { _source: {} } });
            delete = async () => {
                deleteCalls += 1;
                if (deleteCalls === 2) {
                    const error = new Error('not found');
                    error.meta = { statusCode: 404 };
                    throw error;
                }
                return { body: { result: 'deleted' } };
            };
        }

        const store = createSavedSearchStore({ Client: FakeClient });

        await store.deleteById('srch_abc');
        await store.deleteById('srch_abc');

        assert.equal(deleteCalls, 2);
    });
});
