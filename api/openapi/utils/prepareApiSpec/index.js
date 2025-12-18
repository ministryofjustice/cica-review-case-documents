import $RefParser from '@apidevtools/json-schema-ref-parser';
import transformSchemaProperties from '../transformSchemaProperties/index.js';

/**
 * Prepares and transforms an OpenAPI specification by dereferencing all $ref pointers
 * and applying custom property transformations.
 *
 * @async
 * @param {string} path - The file path to the OpenAPI spec (YAML or JSON).
 * @returns {Promise<Object>} The dereferenced and transformed OpenAPI specification object.
 */
async function prepareApiSpec(path) {
    let api = await $RefParser.dereference(path);
    api = transformSchemaProperties(api);
    return api;
}

export default prepareApiSpec;
