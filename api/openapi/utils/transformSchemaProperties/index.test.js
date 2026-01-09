import assert from 'node:assert/strict';
import { test } from 'node:test';
import transformSchemaProperties from './index.js';

test('transformSchemaProperties: should return primitives unchanged', () => {
    assert.strictEqual(transformSchemaProperties(42), 42);
    assert.strictEqual(transformSchemaProperties('foo'), 'foo');
    assert.strictEqual(transformSchemaProperties(null), null);
    assert.strictEqual(transformSchemaProperties(undefined), undefined);
});

test('transformSchemaProperties: should transform x-errorMessage to errorMessage at root', () => {
    const input = { 'x-errorMessage': { minLength: 'Too short' } };
    const result = transformSchemaProperties(input);
    assert.deepEqual(result, { errorMessage: { minLength: 'Too short' } });
});

test('transformSchemaProperties: should transform x-errorMessage to errorMessage nested', () => {
    const input = {
        type: 'object',
        properties: {
            foo: { type: 'string', 'x-errorMessage': { minLength: 'Too short' } }
        }
    };
    const result = transformSchemaProperties(input);
    assert.deepEqual(result, {
        type: 'object',
        properties: {
            foo: { type: 'string', errorMessage: { minLength: 'Too short' } }
        }
    });
});

test('transformSchemaProperties: should handle arrays of objects', () => {
    const input = [{ 'x-errorMessage': { minLength: 'Too short' } }, { foo: 1 }];
    const result = transformSchemaProperties(input);
    assert.deepEqual(result, [{ errorMessage: { minLength: 'Too short' } }, { foo: 1 }]);
});

test('transformSchemaProperties: should not mutate the original object', () => {
    const input = { 'x-errorMessage': { minLength: 'Too short' } };
    const copy = JSON.parse(JSON.stringify(input));
    transformSchemaProperties(input);
    assert.deepEqual(input, copy);
});

test('transformSchemaProperties: should leave objects without x-errorMessage unchanged', () => {
    const input = { type: 'string', minLength: 2 };
    const result = transformSchemaProperties(input);
    assert.deepEqual(result, { type: 'string', minLength: 2 });
});
