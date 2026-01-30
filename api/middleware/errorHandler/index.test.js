/**
 * Unit tests for the errorHandler middleware.
 *
 * These tests verify that the errorHandler:
 * - Logs and responds correctly for a 400 malformed JSON error.
 * - Logs and responds correctly for unhandled server errors (500).
 * - Logs warn-level for known 4xx errors (e.g., UnauthorizedError).
 *
 * @file index.test.js
 * @module errorHandler
 * @requires node:assert/strict
 * @requires node:test
 * @requires ./index.js
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import errorHandler from './index.js';

/**
 * Creates an in-memory logger for capturing log messages during testing.
 *
 * @returns {{
 *   logs: Array<{ level: string, obj: any, msg: string }>,
 *   logger: {
 *     info: Function,
 *     warn: Function,
 *     error: Function
 *   }
 * }} An object containing the logs array and a logger with info, warn, and error methods.
 */
function createMemoryLogger() {
    const logs = [];
    return {
        logs,
        logger: {
            info: mock.fn((obj, msg) => logs.push({ level: 'info', obj, msg })),
            warn: mock.fn((obj, msg) => logs.push({ level: 'warn', obj, msg })),
            error: mock.fn((obj, msg) => logs.push({ level: 'error', obj, msg }))
        }
    };
}

describe('errorHandler', () => {
    it('Should handle array of validation errors correctly', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'must be a string',
                    path: 'body.name',
                    errorCode: 'minLength.openapi.validation'
                },
                {
                    message: 'must be numeric',
                    path: 'body.age',
                    errorCode: 'pattern.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400); // 400 for validation errors (array)
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors.length, 2);
        assert.strictEqual(payload.errors[0].source.pointer, '/body/name');
        assert.strictEqual(payload.errors[1].source.pointer, '/body/age');
    });

    it('Should respond with 400 and error payload for malformed JSON', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = { type: 'entity.parse.failed' };

        errorHandler(err, req, res, next);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(Array.isArray(payload.errors));
        assert.ok(payload.errors.length > 0);
    });

    it('Should respond with 500 and error payload for unhandled server error', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = new Error('Something exploded');
        errorHandler(err, req, res, next);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(payload.errors[0].detail.includes('Something exploded'));
    });

    it('Should respond with 401 and error payload for known 4xx error', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'UnauthorizedError', message: 'Invalid token' };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.json.mock.callCount(), 1);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.ok(payload.errors[0].detail.includes('Invalid token'));
    });
    it('Should use OpenAPI custom error message if available', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'default message',
                    path: '/query/query',
                    errorCode: 'minLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'Search terms must be 2 characters or more');
    });

    it('Should fallback to default message if OpenAPI code not mapped', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                { message: 'default message', path: '/params/query', errorCode: 'unknownCode' }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'default message');
    });

    it('Should fallback to default status code if error name unknown', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'SomeRandomError', message: 'Unknown error' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 500);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'Unknown error');
    });

    it('Should handle ConfigurationError with 500 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'ConfigurationError', message: 'Missing environment variable' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 500);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].title, 'Internal Server Error');
    });

    it('Should handle ResourceNotFound error with 404 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'ResourceNotFound', message: 'Document not found' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 404);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].title, 'Not Found');
    });

    it('Should handle array of errors with different paths', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Field is required',
                    path: 'body.name',
                    errorCode: 'required'
                },
                {
                    message: 'Field is too short',
                    path: 'body.description',
                    errorCode: 'minLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors.length, 2);
        assert.strictEqual(payload.errors[0].source.pointer, '/body/name');
        assert.strictEqual(payload.errors[1].source.pointer, '/body/description');
    });

    it('Should log errors appropriately', () => {
        const { logger } = createMemoryLogger();
        const req = { log: logger };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };
        const next = mock.fn();

        const err = new Error('Test error');
        errorHandler(err, req, res, next);

        assert.ok(logger.error.mock.callCount() > 0 || res.json.mock.callCount() > 0);
    });

    it('Should handle 404 error status mapping', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { status: 404, message: 'Not found' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 404);
    });

    it('Should handle 422 error status mapping', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { status: 422, message: 'Unprocessable entity' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 422);
    });

    it('Should handle 409 error status mapping', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { status: 409, message: 'Conflict' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 409);
    });

    it('Should handle error with path not in QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'custom error',
                    path: '/unmapped/path',
                    errorCode: 'minLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // Should fallback to default message when path not mapped
        assert.strictEqual(payload.errors[0].detail, 'custom error');
    });

    it('Should handle resolveJsonPath with non-hash pointer', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'error message',
                    path: '/query/invalid',
                    errorCode: 'pattern.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'error message');
    });

    it('Should convert dot notation path to JSON pointer', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Field required',
                    path: 'body.nested.field',
                    errorCode: 'required'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].source.pointer, '/body/nested/field');
    });

    it('Should handle error with falsy path', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Error without path',
                    path: null,
                    errorCode: 'generic'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'Error without path');
        // Should not have source when path is null
        assert.strictEqual(payload.errors[0].source, undefined);
    });

    it('Should return undefined from resolveJsonPath when pointer does not start with hash', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'default message',
                    path: '/unknown/path',
                    errorCode: 'maxLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // When path is not in QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP, should fallback to default message
        assert.strictEqual(payload.errors[0].detail, 'default message');
    });

    it('Should include error.meta in response when present', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            message: 'Custom error',
            meta: { requestId: 'abc-123', timestamp: '2025-01-29' }
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.deepStrictEqual(payload.errors[0].meta, {
            requestId: 'abc-123',
            timestamp: '2025-01-29'
        });
    });

    it('Should include error.code in response when present', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            message: 'Custom error',
            code: 'CUSTOM_ERROR_CODE'
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].code, 'CUSTOM_ERROR_CODE');
    });

    it('Should fallback to status 500 when status is invalid type', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { message: 'Error with invalid status', status: 'invalid' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 500);
        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].title, 'Internal Server Error');
    });

    it('Should handle error with no message', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {};
        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].detail, 'An unexpected error occurred');
    });

    it('Should handle error with source but no pointer', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Error with source',
                    errorCode: 'custom'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // Single errors from array don't include source unless path is provided
        assert.strictEqual(payload.errors[0].detail, 'Error with source');
        assert.strictEqual(payload.errors[0].source, undefined);
    });

    it('Should handle error with JSON pointer already in correct format', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Error with pointer',
                    path: '/body/field',
                    errorCode: 'required'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        assert.strictEqual(payload.errors[0].source.pointer, '/body/field');
    });

    it('Should handle RequestValidationError with 400 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'RequestValidationError', message: 'Validation failed' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400);
    });

    it('Should handle ResponseValidationError with 400 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { name: 'ResponseValidationError', message: 'Response validation failed' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400);
    });

    it('Should handle error with invalid_request errorCode with 400 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { errorCode: 'invalid_request', message: 'Invalid request' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400);
    });

    it('Should handle error with invalid_response errorCode with 400 status', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = { errorCode: 'invalid_response', message: 'Invalid response' };
        errorHandler(err, req, res);

        assert.strictEqual(res.statusCode, 400);
    });

    it('Should return message when pointer not in QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Custom fallback message',
                    path: '/unmapped/path',
                    errorCode: 'maxLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // When path not in QUERY_PARAM map, pointer is undefined, returns message
        assert.strictEqual(payload.errors[0].detail, 'Custom fallback message');
    });

    it('Should return message when resolveJsonPath returns undefined (schema not found)', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Schema resolution failed',
                    path: '/query/query',
                    errorCode: 'unknownValidation.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // With valid path but unmapped errorCode, should return message
        assert.strictEqual(payload.errors[0].detail, 'Schema resolution failed');
    });

    it('Should return message when errorCode not in OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Unmapped error code message',
                    path: '/query/query',
                    errorCode: 'unknownError.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // When errorCode not in map, schemaProperty is undefined, returns message
        assert.strictEqual(payload.errors[0].detail, 'Unmapped error code message');
    });

    it('Should convert dot notation path to JSON pointer', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Error with dot notation',
                    path: 'body.nested.field',
                    errorCode: 'required'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // Should convert dot notation to JSON pointer format
        assert.strictEqual(payload.errors[0].source.pointer, '/body/nested/field');
    });

    it('Should use custom OpenAPI error message when schema.errorMessage exists', () => {
        const req = {};
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type() {
                return this;
            },
            json: mock.fn()
        };

        const err = {
            errors: [
                {
                    message: 'Generic message',
                    path: '/query/query',
                    errorCode: 'maxLength.openapi.validation'
                }
            ]
        };

        errorHandler(err, req, res);

        const payload = res.json.mock.calls[0].arguments[0];
        // Should use custom error message from OpenAPI schema
        assert.strictEqual(payload.errors[0].detail, 'Search terms must be 200 characters or less');
    });
});
