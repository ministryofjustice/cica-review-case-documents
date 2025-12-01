import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import express from 'express';
import createTemplateEngineService from '../../../templateEngine/index.js';

import TITLE_HTML_WITH_NO_SUBNAV from './fixtures/title-html-with-no-subnav.js';
import TITLE_HTML_WITH_SUBNAV from './fixtures/title-html-with-subnav.js';
import TITLE_HTML_WITH__SUBNAV_WITH_MENU from './fixtures/title-html-with-subnav-with-menu.js';

const TITLE_TEXT_FRAGMENT =
    '<span class="moj-identity-bar__title">&lt;strong&gt;CRN: 25-111111&lt;/strong&gt;</span>';
const TITLE_HTML_FRAGMENT =
    '<span class="moj-identity-bar__title"><strong>CRN: 25-111111</strong></span>';

let app;
let templateEngineService;

/**
 * Removes all whitespace characters from the given string.
 *
 * @param {string} str - The input string from which whitespace will be removed.
 * @returns {string} The string with all whitespace characters removed.
 */
function removeWhitespace(str) {
    return str.replace(/\s+/g, '');
}

describe('cicaIdentityBarWithSubNav', () => {
    beforeEach(() => {
        app = express();
        templateEngineService = createTemplateEngineService(app);
        templateEngineService.init();
    });
    describe('Basic usage', () => {
        it('Should render an identity bar with a subnav', () => {
            const { render } = templateEngineService;

            const html = render(`
                {% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
                {{ cicaIdentityBarWithSubNav({
                    title: {
                        html: '<strong>CRN: 25-111111</strong>'
                    },
                    subNav: {
                        label: "Sub navigation",
                        items: [
                            {
                                text: "Search",
                                href: "/search",
                                active: true
                            },
                            {
                                text: "Documents",
                                href: "/document"
                            }
                        ]
                    }
                }) }}
            `);
            assert.equal(removeWhitespace(html), removeWhitespace(TITLE_HTML_WITH_SUBNAV));
        });
        it('Should render an identity bar without a subnav', () => {
            const { render } = templateEngineService;

            const html = render(`
                {% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
                {{ cicaIdentityBarWithSubNav({
                    title: {
                        html: '<strong>CRN: 25-111111</strong>'
                    }
                }) }}
            `);
            assert.equal(removeWhitespace(html), removeWhitespace(TITLE_HTML_WITH_NO_SUBNAV));
        });
    });
    describe('title', () => {
        it('Should render a html title', () => {
            const { render } = templateEngineService;

            const html = render(`
                {% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
                {{ cicaIdentityBarWithSubNav({
                    title: {
                        html: '<strong>CRN: 25-111111</strong>'
                    },
                    subNav: {
                        label: "Sub navigation",
                        items: [
                            {
                                text: "Search",
                                href: "/search",
                                active: true
                            },
                            {
                                text: "Documents",
                                href: "/document"
                            }
                        ]
                    }
                }) }}
            `);
            assert.match(removeWhitespace(html), new RegExp(removeWhitespace(TITLE_HTML_FRAGMENT)));
        });
        it('Should render a text title', () => {
            const { render } = templateEngineService;

            const html = render(`
                {% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
                {{ cicaIdentityBarWithSubNav({
                    title: {
                        text: '<strong>CRN: 25-111111</strong>'
                    }
                }) }}
            `);
            assert.match(removeWhitespace(html), new RegExp(removeWhitespace(TITLE_TEXT_FRAGMENT)));
        });
    });
    describe('menu', () => {
        it('Should render a menu', () => {
            const app = express();
            const templateEngineService = createTemplateEngineService(app);
            const { render } = templateEngineService;

            const html = render(`
                {% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
                {{ cicaIdentityBarWithSubNav({
                    title: {
                        html: '<strong>CRN: 25-111111</strong>'
                    },
                    subNav: {
                        label: "Sub navigation",
                        items: [
                            {
                                text: "Search",
                                href: "/search",
                                active: true
                            },
                            {
                                text: "Documents",
                                href: "/document"
                            }
                        ]
                    },
                    menus: [
                        {
                            buttonText: "Actions",
                            items: [
                                {
                                    text: "Download",
                                    href: "/download"
                                }
                            ]
                        }
                    ]
                }) }}
            `);
            assert.equal(
                removeWhitespace(html),
                removeWhitespace(TITLE_HTML_WITH__SUBNAV_WITH_MENU)
            );
        });
    });
});
