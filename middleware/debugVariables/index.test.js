import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DEBUG_VARIABLES,
    default as debugVariablesMiddleware,
    getDebugVariableDefaults,
    getDebugVariableNames,
    getQueryDslOverrides,
    parseDebugVariablesFromQuery,
    validateDebugVariables
} from './index.js';

describe('Debug Variables Configuration', () => {
    it('should define all expected debug variables', () => {
        const names = getDebugVariableNames();
        assert.deepStrictEqual(names, [
            'semanticMinScore',
            'semanticOnlyMinScore',
            'semanticK',
            'lexicalBoost',
            'dateBoost',
            'neuralBoost'
        ]);
    });

    it('should have default values for all variables', () => {
        const defaults = getDebugVariableDefaults();
        assert.strictEqual(typeof defaults.semanticMinScore, 'number');
        assert.strictEqual(typeof defaults.semanticOnlyMinScore, 'number');
        assert.strictEqual(typeof defaults.semanticK, 'number');
        assert.strictEqual(typeof defaults.lexicalBoost, 'number');
        assert.strictEqual(typeof defaults.dateBoost, 'number');
        assert.strictEqual(typeof defaults.neuralBoost, 'number');
    });

    it('should return frozen defaults object', () => {
        const defaults = getDebugVariableDefaults();
        assert.throws(() => {
            defaults.newVar = 123;
        }, TypeError);
    });

    it('should freeze DEBUG_VARIABLES array', () => {
        assert.throws(() => {
            DEBUG_VARIABLES.push({ name: 'fake', default: 0 });
        }, TypeError);
    });
});

describe('parseDebugVariablesFromQuery', () => {
    it('should parse valid numeric query parameters', () => {
        const parsed = parseDebugVariablesFromQuery({
            semanticMinScore: '1.25',
            semanticK: '120',
            lexicalBoost: '10.5'
        });

        assert.strictEqual(parsed.semanticMinScore, 1.25);
        assert.strictEqual(parsed.semanticK, 120);
        assert.strictEqual(parsed.lexicalBoost, 10.5);
    });

    it('should ignore invalid values', () => {
        const parsed = parseDebugVariablesFromQuery({
            semanticMinScore: '-1',
            semanticK: '0',
            lexicalBoost: 'abc'
        });

        assert.deepStrictEqual(parsed, {});
    });

    it('should handle array values by using the last element', () => {
        const parsed = parseDebugVariablesFromQuery({
            semanticK: ['10', '20', '120']
        });

        assert.strictEqual(parsed.semanticK, 120);
    });

    it('should ignore empty strings', () => {
        const parsed = parseDebugVariablesFromQuery({
            semanticMinScore: '',
            semanticK: '   '
        });

        assert.deepStrictEqual(parsed, {});
    });

    it('should return empty object for no matching params', () => {
        const parsed = parseDebugVariablesFromQuery({
            unknownVar: '123'
        });

        assert.deepStrictEqual(parsed, {});
    });
});

describe('validateDebugVariables', () => {
    it('should apply defaults when values are missing', () => {
        const validated = validateDebugVariables({});
        const defaults = getDebugVariableDefaults();

        assert.deepStrictEqual(validated, defaults);
    });

    it('should keep valid session values', () => {
        const sessionVars = {
            semanticK: 150,
            lexicalBoost: 15
        };
        const validated = validateDebugVariables(sessionVars);

        assert.strictEqual(validated.semanticK, 150);
        assert.strictEqual(validated.lexicalBoost, 15);
    });

    it('should replace invalid session values with defaults', () => {
        const sessionVars = {
            semanticK: -5,
            lexicalBoost: 'invalid'
        };
        const validated = validateDebugVariables(sessionVars);
        const defaults = getDebugVariableDefaults();

        assert.strictEqual(validated.semanticK, defaults.semanticK);
        assert.strictEqual(validated.lexicalBoost, defaults.lexicalBoost);
    });

    it('should merge partial session values with defaults', () => {
        const sessionVars = {
            semanticK: 200
        };
        const validated = validateDebugVariables(sessionVars);
        const defaults = getDebugVariableDefaults();

        assert.strictEqual(validated.semanticK, 200);
        assert.strictEqual(validated.semanticMinScore, defaults.semanticMinScore);
        assert.strictEqual(validated.dateBoost, defaults.dateBoost);
    });
});

describe('getQueryDslOverrides', () => {
    it('should return only query DSL keys from a broader debug variable bag', () => {
        const overrides = getQueryDslOverrides({
            semanticK: 200,
            lexicalBoost: 15,
            debugPanelOpen: true,
            someOtherDebugFlag: 'on'
        });

        assert.deepStrictEqual(overrides, {
            semanticK: 200,
            lexicalBoost: 15
        });
    });

    it('should ignore non-finite and non-number values', () => {
        const overrides = getQueryDslOverrides({
            semanticK: '200',
            lexicalBoost: Number.NaN,
            dateBoost: Number.POSITIVE_INFINITY,
            neuralBoost: 3
        });

        assert.deepStrictEqual(overrides, {
            neuralBoost: 3
        });
    });
});

describe('debugVariablesMiddleware', () => {
    it('should set mutable res.locals.debugVariables in non-debug mode', () => {
        const req = {
            session: {
                debugVariables: { semanticK: 999 }
            },
            query: {}
        };
        const res = {
            locals: {
                featureFlags: { debug: false }
            }
        };

        debugVariablesMiddleware(req, res, () => {});

        assert.equal(res.locals.debugVariables.semanticK, getDebugVariableDefaults().semanticK);
        res.locals.debugVariables.someExtraField = 'ok';
        assert.equal(res.locals.debugVariables.someExtraField, 'ok');
        assert.deepEqual(req.session.debugVariables, { semanticK: 999 });
    });

    it('should not rewrite session debugVariables when validated values are unchanged', () => {
        const existingDebugVariables = validateDebugVariables({
            semanticK: 150,
            lexicalBoost: 15
        });

        const req = {
            session: {
                debugVariables: existingDebugVariables
            },
            query: {}
        };
        const res = {
            locals: {
                featureFlags: { debug: true }
            }
        };

        debugVariablesMiddleware(req, res, () => {});

        assert.strictEqual(req.session.debugVariables, existingDebugVariables);
        assert.deepStrictEqual(res.locals.debugVariables, existingDebugVariables);
    });

    it('should persist debugVariables when query overrides change validated values', () => {
        const existingDebugVariables = validateDebugVariables({ semanticK: 120 });

        const req = {
            session: {
                debugVariables: existingDebugVariables
            },
            query: {
                semanticK: '200'
            }
        };
        const res = {
            locals: {
                featureFlags: { debug: true }
            }
        };

        debugVariablesMiddleware(req, res, () => {});

        assert.notStrictEqual(req.session.debugVariables, existingDebugVariables);
        assert.strictEqual(req.session.debugVariables.semanticK, 200);
        assert.strictEqual(res.locals.debugVariables.semanticK, 200);
    });
});
