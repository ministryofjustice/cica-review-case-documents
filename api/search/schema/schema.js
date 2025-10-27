'use strict';

export default {
    section: {
        schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            required: ['query'],
            additionalProperties: false,
            properties: {
                'query': {
                    type: 'string',
                    minLength: 2,
                    maxLength: 200,
                    errorMessage: {
                        minLength: 'Search terms must be 2 characters or more',
                        maxLength: 'Search terms must be 200 characters or less'
                    }
                }
            },
            errorMessage: {
                required: {
                    'query': 'Enter the search term'
                }
            }
        }
    }
};