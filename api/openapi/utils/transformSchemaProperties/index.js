/**
 * Maps old schema property names to new property names for transformation.
 * @type {Object.<string, string>}
 */
const transformations = {
    'x-errorMessage': 'errorMessage'
};

/**
 * Recursively transforms schema property names according to the `transformations` map.
 * Converts custom extension properties (e.g., 'x-errorMessage') to standard names (e.g., 'errorMessage').
 * Does not mutate the original schema object.
 * Handles circular references by tracking visited objects.
 *
 * @param {*} schema - The schema object or array to transform.
 * @param {WeakSet} [visited] - Internal parameter to track visited objects for circular reference detection.
 * @returns {*} The transformed schema object or array.
 */
function transformSchemaProperties(schema, visited = new WeakSet()) {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    // Detect circular references
    if (visited.has(schema)) {
        return schema;
    }
    visited.add(schema);

    if (Array.isArray(schema)) {
        return schema.map((item) => transformSchemaProperties(item, visited));
    }

    // Preserve special object types (Date, RegExp, etc.) but not plain objects or null-prototype objects
    if (schema instanceof Date || schema instanceof RegExp) {
        return schema;
    }

    // don't mutate the original schema object.
    const transformedSchema = {};

    for (const [key, value] of Object.entries(schema)) {
        const transformedKey = transformations[key] || key;
        transformedSchema[transformedKey] = transformSchemaProperties(value, visited);
    }

    return transformedSchema;
}

export default transformSchemaProperties;
