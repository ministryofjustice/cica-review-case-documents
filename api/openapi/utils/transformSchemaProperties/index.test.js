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

describe('transformSchemaProperties - Edge Cases', () => {
    it('Should handle deeply nested objects (15+ levels)', () => {
        // Create 15-level deep object
        let deep = { 'x-errorMessage': 'Deep' };
        for (let i = 0; i < 15; i++) {
            deep = { level: deep };
        }

        const result = transformSchemaProperties(deep);

        // Should not throw stack overflow
        assert.ok(result);
        // Verify deep transformation worked
        let current = result;
        for (let i = 0; i < 15; i++) {
            current = current.level;
        }
        assert.ok('errorMessage' in current);
        assert.strictEqual(current.errorMessage, 'Deep');
    });

    it('Should handle circular references without infinite loop', () => {
        const schema = {
            name: 'Root',
            'x-errorMessage': 'Error'
        };
        schema.circular = schema; // Create circular reference

        // Should not throw or hang
        const result = transformSchemaProperties(schema);

        assert.ok(result);
        assert.strictEqual(result.name, 'Root');
        assert.strictEqual(result.errorMessage, 'Error');
        // Circular reference should be preserved as-is
        assert.strictEqual(result.circular, schema);
    });

    it('Should handle empty objects and arrays', () => {
        assert.deepEqual(transformSchemaProperties({}), {});
        assert.deepEqual(transformSchemaProperties([]), []);
    });

    it('Should handle arrays with mixed types', () => {
        const mixed = [
            { 'x-errorMessage': 'Obj' },
            'string',
            42,
            null,
            undefined,
            true,
            [{ 'x-errorMessage': 'Nested' }]
        ];

        const result = transformSchemaProperties(mixed);

        assert.deepEqual(result[0], { errorMessage: 'Obj' });
        assert.strictEqual(result[1], 'string');
        assert.strictEqual(result[2], 42);
        assert.strictEqual(result[3], null);
        assert.strictEqual(result[4], undefined);
        assert.strictEqual(result[5], true);
        assert.deepEqual(result[6], [{ errorMessage: 'Nested' }]);
    });

    it('Should handle undefined values', () => {
        const input = {
            'x-errorMessage': undefined,
            field: undefined
        };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, {
            errorMessage: undefined,
            field: undefined
        });
    });

    it('Should preserve Date objects', () => {
        const date = new Date('2025-12-18');
        const input = {
            'x-errorMessage': 'Error',
            createdAt: date
        };

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'Error');
        assert.strictEqual(result.createdAt, date);
        assert.ok(result.createdAt instanceof Date);
    });

    it('Should preserve RegExp objects', () => {
        const regex = /^[a-z]+$/;
        const input = {
            'x-errorMessage': 'Error',
            pattern: regex
        };

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'Error');
        assert.strictEqual(result.pattern, regex);
        assert.ok(result.pattern instanceof RegExp);
    });

    it('Should handle nested arrays with objects', () => {
        const input = {
            items: [
                [{ 'x-errorMessage': 'Level 1' }, { 'x-errorMessage': 'Level 2' }],
                [{ nested: { 'x-errorMessage': 'Deep' } }]
            ]
        };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, {
            items: [
                [{ errorMessage: 'Level 1' }, { errorMessage: 'Level 2' }],
                [{ nested: { errorMessage: 'Deep' } }]
            ]
        });
    });

    it('Should handle objects with no transformable keys', () => {
        const input = {
            field1: 'value1',
            field2: {
                nested: 'value2'
            }
        };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, input);
    });

    it('Should transform at multiple levels independently', () => {
        const input = {
            'x-errorMessage': 'Top',
            level1: {
                'x-errorMessage': 'Mid',
                level2: {
                    'x-errorMessage': 'Bottom'
                }
            },
            array: [{ 'x-errorMessage': 'Array item' }]
        };

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'Top');
        assert.strictEqual(result.level1.errorMessage, 'Mid');
        assert.strictEqual(result.level1.level2.errorMessage, 'Bottom');
        assert.strictEqual(result.array[0].errorMessage, 'Array item');
    });

    it('Should handle objects with numeric keys', () => {
        const input = {
            0: { 'x-errorMessage': 'Zero' },
            1: { 'x-errorMessage': 'One' },
            'x-errorMessage': 'Top'
        };

        const result = transformSchemaProperties(input);

        assert.deepEqual(result, {
            0: { errorMessage: 'Zero' },
            1: { errorMessage: 'One' },
            errorMessage: 'Top'
        });
    });

    it('Should handle very wide objects (many properties)', () => {
        const input = {};
        for (let i = 0; i < 100; i++) {
            input[`prop${i}`] = { 'x-errorMessage': `Error ${i}` };
        }

        const result = transformSchemaProperties(input);

        // Verify transformation worked
        assert.strictEqual(result.prop0.errorMessage, 'Error 0');
        assert.strictEqual(result.prop50.errorMessage, 'Error 50');
        assert.strictEqual(result.prop99.errorMessage, 'Error 99');
        // Verify all 100 properties exist
        assert.strictEqual(Object.keys(result).length, 100);
    });

    it('Should handle objects created with Object.create(null)', () => {
        const input = Object.create(null);
        input['x-errorMessage'] = 'No prototype';
        input.field = 'value';

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'No prototype');
        assert.strictEqual(result.field, 'value');
    });

    it('Should handle boolean values in nested structures', () => {
        const input = {
            'x-errorMessage': 'Error',
            enabled: true,
            disabled: false,
            nested: {
                active: true
            }
        };

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'Error');
        assert.strictEqual(result.enabled, true);
        assert.strictEqual(result.disabled, false);
        assert.strictEqual(result.nested.active, true);
    });

    it('Should handle multiple circular references', () => {
        const obj1 = { name: 'obj1', 'x-errorMessage': 'Error1' };
        const obj2 = { name: 'obj2', 'x-errorMessage': 'Error2' };

        obj1.ref = obj2;
        obj2.ref = obj1;

        const result = transformSchemaProperties({ root: obj1 });

        assert.ok(result.root);
        assert.strictEqual(result.root.errorMessage, 'Error1');
    });

    it('Should handle self-referencing arrays', () => {
        const arr = [{ 'x-errorMessage': 'Item' }];
        arr.push(arr); // Self-reference

        const result = transformSchemaProperties(arr);

        assert.ok(result);
        assert.strictEqual(result[0].errorMessage, 'Item');
    });

    it('Should handle objects with symbol keys (should skip them)', () => {
        const sym = Symbol('test');
        const input = {
            'x-errorMessage': 'Error',
            [sym]: 'symbol value',
            regular: 'value'
        };

        const result = transformSchemaProperties(input);

        // Object.entries doesn't include symbol keys, so they won't be copied
        assert.strictEqual(result.errorMessage, 'Error');
        assert.strictEqual(result.regular, 'value');
        assert.strictEqual(result[sym], undefined);
    });

    it('Should handle complex nested structure with mixed types', () => {
        const input = {
            'x-errorMessage': 'Root error',
            metadata: {
                version: 1,
                active: true,
                tags: ['tag1', 'tag2']
            },
            schemas: [
                {
                    name: 'Schema1',
                    'x-errorMessage': 'Schema error',
                    properties: {
                        field: {
                            'x-errorMessage': 'Field error',
                            type: 'string'
                        }
                    }
                }
            ],
            date: new Date(),
            pattern: /test/
        };

        const result = transformSchemaProperties(input);

        assert.strictEqual(result.errorMessage, 'Root error');
        assert.strictEqual(result.metadata.version, 1);
        assert.strictEqual(result.metadata.active, true);
        assert.deepEqual(result.metadata.tags, ['tag1', 'tag2']);
        assert.strictEqual(result.schemas[0].errorMessage, 'Schema error');
        assert.strictEqual(result.schemas[0].properties.field.errorMessage, 'Field error');
        assert.ok(result.date instanceof Date);
        assert.ok(result.pattern instanceof RegExp);
    });
});
