import got from 'got';
import merge from 'lodash.merge';

/**
 * Creates a request service with methods for making HTTP requests (GET, POST, PATCH)
 * using default options suitable for JSON:API.
 *
 * @returns {Object} An immutable object containing:
 *   - post(options): Sends a POST request. Allows overriding default options.
 *   - get(options): Sends a GET request. Allows overriding default options.
 *   - patch(options): Sends a PATCH request. Allows overriding default options.
 *
 * @example
 * const requestService = createRequestService();
 * requestService.get({ url: '/api/resource' }).then(response => { ... });
 */
function createRequestService() {
    /**
     * Sends a POST request using the provided options.
     *
     * Merges default options with the supplied options, allowing overrides such as headers or responseType.
     *
     * @param {Object} options - Options to override default request settings.
     * @param {string} [options.method] - HTTP method (overrides default 'POST').
     * @param {Object} [options.headers] - HTTP headers to include in the request.
     * @param {string} [options.responseType] - Expected response type (default is 'json').
     * @param {boolean} [options.throwHttpErrors] - Whether to throw HTTP errors (default is false).
     * @returns {Promise<Object>} - A promise that resolves with the response from the request.
     */
    function post(options) {
        let opts = {
            method: 'POST',
            headers: {
                accept: 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json'
            },
            responseType: 'json',
            throwHttpErrors: false
        };
        // allow external overriding of the default internal opts
        // for example to change responseType, or headers
        opts = merge(opts, options);
        return got(opts);
    }

    /**
     * Sends a GET request using the provided options.
     *
     * @param {Object} options - Additional options to override default request settings.
     * @param {string} [options.method] - HTTP method (overrides default 'GET').
     * @param {Object} [options.headers] - Custom headers for the request.
     * @param {string} [options.responseType] - Expected response type (default is 'json').
     * @param {boolean} [options.throwHttpErrors] - Whether to throw HTTP errors (default is false).
     * @returns {Promise<Object>} - A promise that resolves with the response data.
     */
    function get(options) {
        let opts = {
            method: 'GET',
            headers: {
                accept: 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json'
            },
            responseType: 'json',
            throwHttpErrors: false
        };
        // allow externl overriding of the default internal opts
        // for example to change responseType, or headers
        opts = merge(opts, options);
        return got(opts);
    }

    /**
     * Sends a PATCH HTTP request using the provided options.
     *
     * Merges default options with any external overrides, allowing customization
     * of headers, response type, and other request parameters.
     *
     * @param {Object} options - Options to override default request settings.
     * @param {string} [options.method] - HTTP method (overrides default 'PATCH').
     * @param {Object} [options.headers] - Custom headers for the request.
     * @param {string} [options.responseType] - Expected response type (default is 'json').
     * @param {boolean} [options.throwHttpErrors] - Whether to throw HTTP errors (default is false).
     * @returns {Promise<Object>} - A promise that resolves with the response object.
     */
    function patch(options) {
        let opts = {
            method: 'PATCH',
            headers: {
                accept: 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json'
            },
            responseType: 'json',
            throwHttpErrors: false
        };
        // allow external overriding of the default internal opts
        // for example to change responseType, or headers
        opts = merge(opts, options);
        return got(opts);
    }

    return Object.freeze({
        post,
        get
    });
}

export default createRequestService;
