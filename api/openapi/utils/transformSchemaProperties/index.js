const transformations = {
    'x-errorMessage': 'errorMessage'
};

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
