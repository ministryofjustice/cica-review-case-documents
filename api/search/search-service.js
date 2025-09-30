'use strict';

import Ajv from 'ajv';
import AjvErrors from 'ajv-errors';
import VError from 'verror';
import createDocumentDAL from '../../document/document-dal.js';

function createSearchService({
    caseReferenceNumber
}) {
    const db = createDocumentDAL({
        caseReferenceNumber
    });

    const ajv = new Ajv({
        allErrors: true,
        jsonPointers: true,
        format: 'full',
        coerceTypes: true
    });

    AjvErrors(ajv);

    function validateQuery(query) {
        const schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            additionalProperties: false,
            properties: {
                'q-mainapplicant-enter-your-email-address': {
                    type: 'string',
                    title: 'Enter your email address (optional)',
                    description:
                        'We may use this to contact you if we need to clarify something in this application.',
                    maxLength: 50,
                    format: 'email',
                    errorMessage: {
                        maxLength: 'Email address must be 50 characters or less',
                        format: 'Enter your email address, for example john.smith@email.com'
                    }
                }
            }
        };

        const validate = ajv.compile(schema)

        const data = {
            foo: "foo",
            bar: "abc"
        }

        const valid = validate(data)
        if (!valid) {
            const validationError = new VError({
                name: 'JSONSchemaValidationError',
                info: {
                    schema,
                    answers: data,
                    schemaErrors: validate.errors
                }
            });

            throw validationError;
        }
    }

    async function getSearchResultsByKeyword(keyword, caseReferenceNumber, pageNumber, itemsPerPage) {
        // validateQuery(keyword);
        return db.getDocumentsChunksByKeyword(keyword, caseReferenceNumber, pageNumber, itemsPerPage);
    }

    return Object.freeze({
        getSearchResultsByKeyword
    });
}

export default createSearchService;
