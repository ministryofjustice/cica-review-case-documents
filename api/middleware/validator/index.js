import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenApiValidator from 'express-openapi-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Creates and returns an OpenAPI validator middleware for Express using the provided AJV instance and app.
 *
 * Loads the OpenAPI specification from the local filesystem, parses it, and initializes
 * the express-openapi-validator middleware with request and response validation enabled.
 *
 * @async
 * @function createOpenApiValidatorMiddleware
 * @param {Object} options - The options object.
 * @param {Object} options.ajv - The AJV instance to use for validation.
 * @param {Object} options.logger - An optional logger instance for logging errors.
 * @returns {Promise<Function>} The initialized OpenAPI validator middleware function.
 */
export default async function createOpenApiValidatorMiddleware({ ajv, logger, apiSpecPath }) {
    const openApiPath = apiSpecPath || path.join(__dirname, '../../openapi/openapi-dist.json');
    if (!fs.existsSync(openApiPath)) {
        throw new Error(`OpenAPI spec file not found at: ${openApiPath}`);
    }
    return OpenApiValidator.middleware({
        apiSpec: openApiPath,
        validateRequests: true,
        validateResponses: true,
        validateSecurity: false,
        $refParser: { mode: 'dereference' },
        ajv
    });
}
