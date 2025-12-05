import $RefParser from '@apidevtools/json-schema-ref-parser';
import transformSchemaProperties from '../transformSchemaProperties/index.js';

async function prepareApiSpec(path) {
    let api = await $RefParser.dereference(path);

    console.log(api.components.parameters.query);
    api = transformSchemaProperties(api);
    console.log(api.components.parameters.query);
    return api;
}
export default prepareApiSpec;
