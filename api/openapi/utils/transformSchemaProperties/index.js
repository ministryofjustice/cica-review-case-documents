/**
 * Recursively transforms schema property names according to the `transformations` map.
 * Converts custom extension properties (e.g., 'x-errorMessage') to standard names (e.g., 'errorMessage').
 * Does not mutate the original schema object.
 *
 * @param {*} schema - The schema object or array to transform.
 * @returns {*} The transformed schema object or array.
 */
function transformSchemaProperties(schema) {
    if (Array.isArray(schema)) {
        return schema.map(transformSchemaProperties);
    }
    if (schema && typeof schema === 'object') {
        // Clone the object to avoid mutation
        const newObj = {};
        for (const key in schema) {
            if (Object.hasOwn(schema, key)) {
                if (key === 'x-errorMessage') {
                    newObj.errorMessage = schema[key];
                } else {
                    newObj[key] = transformSchemaProperties(schema[key]);
                }
            }
        }
        return newObj;
    }
    return schema;
}

export default transformSchemaProperties;
