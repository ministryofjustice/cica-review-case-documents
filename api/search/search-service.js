'use strict';

// import Ajv from 'ajv';
// import AjvErrors from 'ajv-errors';
import VError from 'verror';
import createDocumentDAL from '../../document/document-dal.js';
import schema from './schema/schema.js';

function createSearchService({
    caseReferenceNumber
}) {
    const db = createDocumentDAL({
        caseReferenceNumber
    });

    // const ajv = new Ajv({
    //     allErrors: true,
    //     jsonPointers: true,
    //     format: 'full',
    //     coerceTypes: true
    // });

    // AjvErrors(ajv);

    async function getSearchResultsByKeyword(keyword, pageNumber, itemsPerPage) {
        // const pageSchema = schema.section.schema;
        // const rawAnswers = {
        //     thing: keyword
        // };
        // const validate = ajv.compile(pageSchema);
        // const valid = validate(rawAnswers);

        // if (!valid) {
        //     const validationError = new VError({
        //         name: 'JSONSchemaValidationError',
        //         info: {
        //             schema: pageSchema,
        //             answers: rawAnswers,
        //             schemaErrors: validate.errors
        //         }
        //     });

        //     throw validationError;
        // }
        return db.getDocumentsChunksByKeyword(keyword, pageNumber, itemsPerPage);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
