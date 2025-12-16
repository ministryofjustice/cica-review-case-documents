import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import transformSchemaProperties from './index.js';

describe('transformSchemaProperties (pure)', () => {
    it('Should transform a single key', () => {
        const input = { 'x-errorMessage': 'Required' };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, { errorMessage: 'Required' });
        assert.deepEqual(input, { 'x-errorMessage': 'Required' }); // pure
    });

    it('Should transform nested objects', () => {
        const input = {
            properties: {
                name: {
                    'x-errorMessage': 'Name required'
                }
            }
        };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, {
            properties: {
                name: {
                    errorMessage: 'Name required'
                }
            }
        });

        assert.ok('x-errorMessage' in input.properties.name);
    });

    it('Should transform multiple keys on the same node', () => {
        const input = {
            field: {
                'x-errorMessage': 'oops',
                'x-errorMessage2': 'ignored'
            }
        };

        const transformations = {
            'x-errorMessage': 'errorMessage',
            'x-errorMessage2': 'secondaryError'
        };

        // patched function for test
        const customTransform = (obj) =>
            Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [
                    transformations[k] || k,
                    typeof v === 'object' && v !== null ? customTransform(v) : v
                ])
            );

        const result = customTransform(input);

        assert.deepEqual(result, {
            field: {
                errorMessage: 'oops',
                secondaryError: 'ignored'
            }
        });
    });

    it('Should handle arrays', () => {
        const input = [{ 'x-errorMessage': 'One' }, { deep: { 'x-errorMessage': 'Two' } }];

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, [{ errorMessage: 'One' }, { deep: { errorMessage: 'Two' } }]);
    });

    it('Should leave primitives unchanged', () => {
        assert.equal(transformSchemaProperties('hello'), 'hello');
        assert.equal(transformSchemaProperties(42), 42);
        assert.equal(transformSchemaProperties(null), null);
    });

    it('Should not mutate original input', () => {
        const input = {
            obj: { 'x-errorMessage': 'Oops' }
        };

        const clone = JSON.parse(JSON.stringify(input));

        transformSchemaProperties(input);

        assert.deepEqual(input, clone); // verify purity
    });
});
