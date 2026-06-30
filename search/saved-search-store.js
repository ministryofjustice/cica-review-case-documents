import crypto from 'node:crypto';
import { Client as defaultClient } from '@opensearch-project/opensearch';
import { nanoid } from 'nanoid';
import VError from 'verror';

const DEFAULT_TTL_DAYS = 30;
const DEFAULT_INDEX_NAME = 'saved_searches';

/**
 * Computes an ISO expiry timestamp from now + TTL days.
 *
 * @param {Date} now - Current date value used as the reference point.
 * @param {number} ttlDays - Number of days before the saved search expires.
 * @returns {string} ISO-8601 timestamp.
 */
function computeExpiry(now, ttlDays) {
    const ttlMs = Math.max(Number(ttlDays) || DEFAULT_TTL_DAYS, 1) * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() + ttlMs).toISOString();
}

/**
 * Returns a masked ID for safer logs.
 *
 * @param {string} id - Saved search identifier.
 * @returns {string} Short hash suffix.
 */
function idHash(id) {
    return crypto.createHash('sha256').update(id).digest('hex').slice(0, 8);
}

/**
 * Creates a persistent saved-search store backed by OpenSearch.
 *
 * Saved definitions can be referenced by opaque IDs to support shareable URLs
 * without exposing sensitive query text in browser query strings.
 *
 * @param {object} [params] - Store configuration.
 * @param {new (...args: any[]) => object} [params.Client=defaultClient] - OpenSearch client constructor.
 * @param {object} [params.logger] - Optional structured logger.
 * @param {() => Date} [params.now] - Test seam for deterministic time handling.
 * @returns {{
 *  create: (input: {query: string, searchType: string, caseReferenceNumber: string, itemsPerPage?: number, ownerUserName?: string, ttlDays?: number}) => Promise<{id: string, expiresAt: string}>,
 *  getById: (id: string) => Promise<object|null>,
 *  deleteById: (id: string) => Promise<void>
 * }} Saved-search store API.
 */
export default function createSavedSearchStore({
    Client = defaultClient,
    logger,
    now = () => new Date()
} = {}) {
    const node = process.env.APP_DATABASE_URL;
    if (!node) {
        throw new VError(
            {
                name: 'ConfigurationError'
            },
            'Environment variable "APP_DATABASE_URL" must be set'
        );
    }

    const index = process.env.APP_SAVED_SEARCH_INDEX_NAME || DEFAULT_INDEX_NAME;
    const client = new Client({ node });

    /**
     * Persists a saved search definition and returns its opaque ID.
     *
     * @param {object} input - Saved search payload.
     * @param {string} input.query - Raw search query text.
     * @param {string} input.searchType - Search mode used to execute this definition.
     * @param {string} input.caseReferenceNumber - Case scope for authorization checks.
     * @param {number} [input.itemsPerPage] - Optional pagination size.
     * @param {string} [input.ownerUserName] - Optional creator identity.
     * @param {number} [input.ttlDays=30] - Number of days before automatic expiry.
     * @returns {Promise<{id: string, expiresAt: string}>} Opaque identifier and expiry timestamp.
     */
    async function create({
        query,
        searchType,
        caseReferenceNumber,
        itemsPerPage,
        ownerUserName,
        ttlDays = DEFAULT_TTL_DAYS
    }) {
        const createdAt = now();
        const id = `srch_${nanoid(16)}`;
        const expiresAt = computeExpiry(createdAt, ttlDays);

        const doc = {
            query,
            searchType,
            caseReferenceNumber,
            itemsPerPage:
                Number(itemsPerPage) || Number(process.env.APP_SEARCH_PAGINATION_ITEMS_PER_PAGE),
            ownerUserName: ownerUserName || null,
            createdAt: createdAt.toISOString(),
            expiresAt,
            lastAccessedAt: null
        };

        await client.index({
            index,
            id,
            body: doc,
            refresh: 'wait_for'
        });

        logger?.info?.(
            {
                idHash: idHash(id),
                caseReferenceNumber,
                expiresAt,
                index
            },
            'Saved search created'
        );

        return { id, expiresAt };
    }

    /**
     * Retrieves a saved search definition by opaque ID.
     *
     * @param {string} id - Saved search identifier.
     * @returns {Promise<object|null>} Stored definition or null when not found.
     */
    async function getById(id) {
        try {
            const response = await client.get({ index, id });
            const source = response?.body?._source || response?._source;
            if (!source) {
                return null;
            }

            return {
                id,
                ...source
            };
        } catch (error) {
            const statusCode = error?.meta?.statusCode;
            if (statusCode === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Deletes a saved search definition by ID.
     *
     * @param {string} id - Saved search identifier.
     * @returns {Promise<void>} Resolves when delete succeeds or record is already absent.
     */
    async function deleteById(id) {
        try {
            await client.delete({ index, id, refresh: 'wait_for' });
        } catch (error) {
            const statusCode = error?.meta?.statusCode;
            if (statusCode !== 404) {
                throw error;
            }
        }
    }

    return Object.freeze({
        create,
        getById,
        deleteById
    });
}
