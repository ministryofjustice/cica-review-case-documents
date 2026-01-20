import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCrn, validateDocumentId, validatePageNumber } from './index.js';

describe('Document Parameter Validation', () => {
    describe('validateDocumentId', () => {
        it('accepts valid UUID format', () => {
            const result = validateDocumentId('123e4567-e89b-12d3-a456-426614174000');
            assert.deepEqual(result, { valid: true });
        });

        it('rejects invalid UUID format', () => {
            const result = validateDocumentId('not-a-uuid');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Invalid document ID format');
        });

        it('rejects empty string', () => {
            const result = validateDocumentId('');
            assert.strictEqual(result.valid, false);
        });

        it('rejects null/undefined', () => {
            let result = validateDocumentId(null);
            assert.strictEqual(result.valid, false);

            result = validateDocumentId(undefined);
            assert.strictEqual(result.valid, false);
        });
    });

    describe('validatePageNumber', () => {
        it('accepts valid positive integers', () => {
            let result = validatePageNumber('1');
            assert.deepEqual(result, { valid: true, value: 1 });

            result = validatePageNumber('100');
            assert.deepEqual(result, { valid: true, value: 100 });
        });

        it('rejects zero', () => {
            const result = validatePageNumber('0');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Invalid page number');
        });

        it('rejects negative numbers', () => {
            const result = validatePageNumber('-5');
            assert.strictEqual(result.valid, false);
        });

        it('rejects non-integer values', () => {
            let result = validatePageNumber('1.5');
            assert.strictEqual(result.valid, false);

            result = validatePageNumber('abc');
            assert.strictEqual(result.valid, false);
        });

        it('accepts numeric values (not just strings)', () => {
            const result = validatePageNumber(42);
            assert.deepEqual(result, { valid: true, value: 42 });
        });
    });

    describe('validateCrn', () => {
        it('accepts valid CRN formats', () => {
            let result = validateCrn('12-745678');
            assert.deepEqual(result, { valid: true });

            result = validateCrn('99-812345');
            assert.deepEqual(result, { valid: true });
        });

        it('rejects empty string', () => {
            const result = validateCrn('');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Invalid case reference number');
        });

        it('rejects null/undefined', () => {
            let result = validateCrn(null);
            assert.strictEqual(result.valid, false);

            result = validateCrn(undefined);
            assert.strictEqual(result.valid, false);
        });

        it('rejects special characters', () => {
            const result = validateCrn('12@345');
            assert.strictEqual(result.valid, false);
        });

        it('rejects invalid CRN pattern', () => {
            const result = validateCrn('12-345678');
            assert.strictEqual(result.valid, false);
        });
    });
});
