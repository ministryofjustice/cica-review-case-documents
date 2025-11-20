import { Client } from '@opensearch-project/opensearch';
import { URL } from 'url';

/**
 * Checks the health of the OpenSearch cluster at the given proxy URL.
 * Retries until healthy or timeout is reached.
 *
 * @param {string} proxyUrl - The OpenSearch proxy/base URL.
 * @param {number} timeout - Maximum seconds to wait for health.
 * @param {number} interval - Seconds between retries.
 * @returns {Promise<boolean>} True if healthy, False otherwise.
 */
export async function checkOpenSearchHealth(proxyUrl, timeout = 10, interval = 1000) {
    console.info(`OpenSearch ${proxyUrl} health check started`);
    const parsed = new URL(proxyUrl);
    const client = new Client({
        node: proxyUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    const start = Date.now();
    while ((Date.now() - start) / 1000 < timeout) {
        try {
            const { body } = await client.cluster.health();
            const status = body.status;
            if (status === 'green' || status === 'yellow') {
                console.info(`OpenSearch health check passed: status=${status}`);
                return true;
            } else {
                console.warn(`OpenSearch unhealthy: status=${status}`);
            }
        } catch (e) {
            console.warn(`OpenSearch not reachable: ${e.message}`);
        }
        await new Promise((res) => setTimeout(res, interval));
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.error(
        `OpenSearch health check failed for ${proxyUrl}: timeout reached after ${elapsed} seconds.`
    );
    return false;
}
