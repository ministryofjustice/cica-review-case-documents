'use strict';

import nunjucks from 'nunjucks';
import VError from 'verror';
import isFilePath from './utils/isFilePath/index.js';

let environment;

/**
 * Factory function to create a Nunjucks template engine service.
 *
 * @param {object} [app] - Optional Express app instance to integrate with Nunjucks.
 * @returns {object} An object containing methods to initialise the environment, render templates, and access the engine:
 *   @property {Function} init - Initializes and returns the Nunjucks environment.
 *   @property {Function} render - Renders a template file or string.
 *   @property {Function} getEngine - Returns the Nunjucks module.
 *   @property {Function} getEnvironment - Returns the current environment or undefined.
 */
function createTemplateEngineService(app) {
    let initialised = false;
    /**
     * Initializes the Nunjucks environment if it hasn't been created yet.
     *
     * @throws {VError} Throws `MissingExpressAppError` if an Express app is not provided.
     * @returns {nunjucks.Environment} The Nunjucks environment instance.
     */
    function init() {
        if (!app) {
            throw new VError(
                {
                    name: 'MissingExpressAppError'
                },
                'Cannot initialize Nunjucks environment: Express app instance is required. ' +
                'Please pass the Express app when calling createTemplateEngineService(app).'
            );
        }

        initialised = true;

        if (environment) {
            return environment;
        }

        const configObject = {
            autoescape: true,
            throwOnUndefined: false
        };

        const loader = new nunjucks.FileSystemLoader([
            '', // root directory.
            'page/',
            'partial/',
            'node_modules/@ministryofjustice/frontend/',
            // allows the `{% from "govuk/macros/attributes.njk" ...` import in moj identity-bar/template.njk to work.
            'node_modules/govuk-frontend/dist/',
            'node_modules/govuk-frontend/dist/govuk/',
            'node_modules/govuk-frontend/dist/govuk/components/',
            'components/'
        ]);
        environment = new nunjucks.Environment(loader, configObject);
        environment.addGlobal('APP_VERSION', process.env.npm_package_version)
        environment.addGlobal('APP_BUILDTIME_ID', process.env.APP_BUILDTIME_ID)
        environment.addGlobal('govukRebrand', true);
        environment.express(app);
        app.engine('njk', environment.render.bind(environment));
        app.set('view engine', 'njk');

        return environment;
    }

    /**
     * Renders a Nunjucks template string or file.
     *
     * @param {string} template - Template string or file path.
     * @param {object} [params={}] - Parameters to pass to the template.
     * @returns {string} Rendered HTML string.
     */
    function render(string, params) {
        if (!environment) {
            return init();
        }
        if (isFilePath(string)) {
            return environment.render(string, params);
        }
        return environment.renderString(string, params);
    }

    /**
     * Gets the Nunjucks engine module.
     *
     * @returns {object} The Nunjucks module.
     */
    function getEngine() {
        return nunjucks;
    }

    /**
     * Gets the current Nunjucks environment instance.
     *
     * @returns {nunjucks.Environment|undefined} The Nunjucks environment or undefined if not initialized.
     */
    function getEnvironment() {
        if (initialised === true) {
            return environment;
        }
    }

    return Object.freeze({
        init,
        render,
        getEngine,
        getEnvironment
    });
}

export default createTemplateEngineService;
