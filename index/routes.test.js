import assert from 'node:assert';
import { describe, it } from 'node:test';

import request from 'supertest';
import createApp from '../app.js';

const routes = [
    {
        path: '/',
        template: 'index/index.njk',
        expected: '<title>Hello, World! - CICA FIND - GOV.UK</title>'
    },
    {
        path: '/cookies',
        template: 'index/cookies.njk',
        expected: '<title>Cookies - CICA FIND - GOV.UK</title>'
    },
    {
        path: '/contact-us',
        template: 'index/contact-us.njk',
        expected: '<title>Contact us - CICA FIND - GOV.UK</title>'
    },
    {
        path: '/accessibility-statement',
        template: 'index/accessibility-statement.njk',
        expected: '<title>Accessibility statement - CICA FIND - GOV.UK</title>'
    }
];

describe('Index routes', () => {
    const app = createApp();

    for (const route of routes) {
        it(`GET ${route.path} should return rendered HTML`, async () => {
            const res = await request(app).get(route.path);
            assert.equal(res.status, 200);
            assert.match(res.text, new RegExp(route.expected));
        });
    }
});
