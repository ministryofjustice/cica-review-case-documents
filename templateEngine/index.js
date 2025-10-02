'use strict';

import nunjucks from 'nunjucks';
import isFilePath from './utils/isFilePath/index.js';

let environment;

function createTemplateEngineService(app) {
    function init() {
        if (environment) {
            return environment;
        }

        const configObject = {
            autoescape: true
        };

        if (app) {
            configObject.express = app;
        }

        environment = nunjucks
            .configure(
                [
                    'node_modules/@ministryofjustice/frontend/',
                    // allows the `{% from "govuk/macros/attributes.njk" ...` import in moj identity-bar/template.njk to work.
                    'node_modules/govuk-frontend/dist/',
                    'node_modules/govuk-frontend/dist/govuk/',
                    'node_modules/govuk-frontend/dist/govuk/components/',
                    'components/',
                    '', // root directory.
                    'page/',
                    'partial/'
                ],
                configObject
            )
            .addGlobal('APP_APP_VERSION', process.env.npm_package_version)
            .addGlobal('APP_BUILDTIME_ID', process.env.APP_BUILDTIME_ID)
            .addGlobal('govukRebrand', true);

        return environment;
    }

    function render(string, params) {
        if (isFilePath(string)) {
            return nunjucks.render(string, params);
        }
        return nunjucks.renderString(string, params);
    }

    function getEngine() {
        return nunjucks;
    }

    function getEnvironment() {
        return environment;
    }

    return Object.freeze({
        init,
        render,
        getEngine,
        getEnvironment
    });
}

export default createTemplateEngineService;
