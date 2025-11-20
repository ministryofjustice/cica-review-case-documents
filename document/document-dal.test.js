import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import VError from 'verror';
import createDocumentDAL from './document-dal.js';
const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {}
};

describe('document-dal', () => {
    const ENV_ORIGINAL = {
        ...process.env,
        OPENSEARCH_INDEX_CHUNKS_NAME: 'test-idex'
    };
    const CREATE_DB_QUERY_INSTANCE = {
        SUCCESS: {
            query: async () => {
                return {
                    body: {
                        hits: [
                            { _id: 'doc1', _source: { chunk_text: 'foo', case_ref: '12-345678' } }
                        ]
                    }
                };
            }
        },
        FAILURE: {
            query: async () => {
                throw new Error('db failure');
            }
        },
        EMPTY: {
            query: async () => {
                return {
                    body: {
                        hits: []
                    }
                };
            }
        }
    };
    beforeEach(() => {
        process.env = { ...ENV_ORIGINAL };
    });

    it('Should throw if OPENSEARCH_INDEX_CHUNKS_NAME is not set', () => {
        delete process.env.OPENSEARCH_INDEX_CHUNKS_NAME;
        assert.throws(
            () =>
                createDocumentDAL({
                    caseReferenceNumber: '12-345678',
                    createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS
                }),
            (err) =>
                err.name === 'ConfigurationError' &&
                /Environment variable "OPENSEARCH_INDEX_CHUNKS_NAME" must be set/.test(err.message)
        );
    });

    it('Should return body.hits from DB response', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.SUCCESS,
            logger: mockLogger
        });

        const results = await dal.getDocumentsChunksByKeyword('foo', 1, 10);

        assert.equal(results.length, 1);
        assert.equal(results[0]._id, 'doc1');
        assert.equal(results[0]._source.chunk_text, 'foo');
    });

    it('Should rethrow if an error if db.query throws', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.FAILURE
        });

        await assert.rejects(
            () => dal.getDocumentsChunksByKeyword('foo', 1, 10),
            (err) => err instanceof VError && /Failed to execute search query/.test(err.message)
        );
    });

    it('Should return an empty array if response has no hits', async () => {
        const dal = createDocumentDAL({
            caseReferenceNumber: '12-345678',
            createDBQuery: () => CREATE_DB_QUERY_INSTANCE.EMPTY,
            logger: mockLogger
        });

        const result = await dal.getDocumentsChunksByKeyword('keyword', 1, 10);
        assert.deepEqual(result, []);
    });
});
