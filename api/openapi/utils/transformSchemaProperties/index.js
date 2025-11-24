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
 *
 * @param {*} schema - The schema object or array to transform.
 * @returns {*} The transformed schema object or array.
 */
function transformSchemaProperties(schema) {
    if (!schema || typeof schema !== 'object') return schema;

    if (Array.isArray(schema)) {
        return schema.map((item) => transformSchemaProperties(item));
    }

    for (const [oldKey, newKey] of Object.entries(transformations)) {
        if (oldKey in schema) {
            schema[newKey] = schema[oldKey];
            delete schema[oldKey];
        }
    }

    // don't mutate the original schema object.
    const transformedSchema = {};

    for (const [key, value] of Object.entries(schema)) {
        const transformedKey = transformations[key] || key;
        transformedSchema[transformedKey] = transformSchemaProperties(value);
    }

    return transformedSchema;
}

export default transformSchemaProperties;
