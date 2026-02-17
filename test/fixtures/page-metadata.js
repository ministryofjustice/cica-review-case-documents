/**
 * Default mock page metadata payload returned by the page metadata API shared by API and document service tests.
 */
const DEFAULT_PAGE_METADATA = Object.freeze({
    correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST',
    page_count: 50,
    page_num: 1,
    imageUrl: 's3://bucket-name/case-ref-num/test-doc/pages/1.png',
    text: 'Sample page text content'
});

/**
 * Builds a page metadata payload for tests.
 *
 * @param {object} [options] - Fixture options.
 * @param {object} [options.overrides] - Properties to overwrite in the default payload.
 * @param {string[]} [options.omit] - Property names to remove from the payload.
 * @returns {object} Page metadata payload.
 */
export function buildPageMetadataFixture(options = {}) {
    const { overrides = {}, omit = [] } = options;
    const payload = { ...DEFAULT_PAGE_METADATA, ...overrides };

    for (const key of omit) {
        delete payload[key];
    }

    return payload;
}

/**
 * Wraps page metadata payload in the standard API response body shape.
 *
 * @param {object} [options] - Fixture options passed to `buildPageMetadataFixture`.
 * @returns {{data: object}} API body object with `data` payload.
 */
export function buildPageMetadataApiBody(options = {}) {
    return {
        data: buildPageMetadataFixture(options)
    };
}
