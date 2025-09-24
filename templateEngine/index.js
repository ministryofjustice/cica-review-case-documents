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
            .addGlobal(
                'CRCD_MAINTENANCE_MESSAGE',
                !process.env?.CW_MAINTENANCE_MESSAGE?.length
                    ? 'maintenance message not set'
                    : process.env.CW_MAINTENANCE_MESSAGE
            )
            .addGlobal(
                'CRCD_MAINTENANCE_MESSAGE_ENABLED',
                process.env.CW_MAINTENANCE_MESSAGE_ENABLED === 'true'
            )
            .addGlobal('CRCD_APP_VERSION', process.env.npm_package_version)
            .addGlobal('CRCD_GOVUK_ACCOUNT_URL', process.env.CRCD_GOVUK_ACCOUNT_URL)
            .addGlobal('CRCD_BUILDTIME_ID', process.env.CRCD_BUILDTIME_ID)
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
