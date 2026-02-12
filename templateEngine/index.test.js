import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import createTemplateEngineService from './index.js';

/**
 * Imports a fresh instance of the template engine module.
 *
 * Appends a cache-busting query string so each test can load isolated module
 * state and avoid cross-test pollution from module-level variables.
 *
 * @returns {Promise<Function>} The default `createTemplateEngineService` export.
 */
async function importFreshTemplateEngineService() {
    const module = await import(`./index.js?fresh=${Date.now()}-${Math.random()}`);
    return module.default;
}

describe('createTemplateEngineService', () => {
    describe('init', () => {
        it('Should initialise environment with Express app', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            const environment = templateEngineService.init();
            assert.ok(environment, 'Environment should be created');
            assert.strictEqual(
                typeof environment.render,
                'function',
                'Environment has render function'
            );
        });

        it('Should register and execute formatDate filter', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            const environment = templateEngineService.init();

            const inputDate = '2026-02-12T10:30:00Z';
            const formatDate = environment.getFilter('formatDate');
            const result = formatDate(inputDate);
            const expected = new Date(inputDate).toLocaleString('en-GB', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });

            assert.strictEqual(result, expected);
        });

        it('Should throw MissingExpressAppError if app not provided', () => {
            const templateEngineService = createTemplateEngineService();
            assert.throws(
                () => templateEngineService.init(),
                (err) =>
                    err.name === 'MissingExpressAppError' &&
                    /Express app instance is required/.test(err.message)
            );
        });
    });

    describe('render', () => {
        it('Should lazily initialise environment when render is called before init', async () => {
            const createFreshTemplateEngineService = await importFreshTemplateEngineService();
            const app = express();
            const templateEngineService = createFreshTemplateEngineService(app);

            const result = templateEngineService.render('Hello {{ name }}', {
                name: 'World'
            });

            assert.strictEqual(result, 'Hello World');
            assert.strictEqual(
                typeof templateEngineService.getEnvironment().render,
                'function',
                'environment should be initialised after render'
            );
        });

        it('Should throw MissingExpressAppError when render is called before init without app', async () => {
            const createFreshTemplateEngineService = await importFreshTemplateEngineService();
            const templateEngineService = createFreshTemplateEngineService();

            assert.throws(
                () => templateEngineService.render('Hello {{ name }}', { name: 'World' }),
                (err) =>
                    err.name === 'MissingExpressAppError' &&
                    /Express app instance is required/.test(err.message)
            );
        });

        it('Should render template file correctly', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            templateEngineService.init();
            const html = templateEngineService.render('templateEngine/fixture/render-test.njk', {
                value: 123
            });
            assert.strictEqual(html, 'File template: 123');
        });

        it('Should render template string correctly', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            templateEngineService.init();
            const html = templateEngineService.render('Hello {{ name }}', {
                name: 'World'
            });
            assert.strictEqual(html, 'Hello World');
        });
    });

    describe('getEngine', () => {
        it('Should return Nunjucks module', async () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            templateEngineService.init();
            const nunjucksModule = await import('nunjucks');
            assert.strictEqual(templateEngineService.getEngine(), nunjucksModule.default);
        });
    });

    describe('getEnvironment', () => {
        it('Should return environment', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            const environment = templateEngineService.init();
            assert.strictEqual(
                templateEngineService.getEnvironment(),
                environment,
                'getEnvironment() returns same instance'
            );
        });
        it('Should return undefined if init has not been called', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            assert.strictEqual(templateEngineService.getEnvironment(), undefined);
        });
    });
});
