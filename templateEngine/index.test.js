import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import createTemplateEngineService from './index.js';

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
