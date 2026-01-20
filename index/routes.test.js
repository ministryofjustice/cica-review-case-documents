import assert from 'node:assert';
import { before, describe, it } from 'node:test';

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
    let app;
    before(async () => {
        // Set required environment variables for app initialization
        process.env.APP_COOKIE_NAME = 'testcookiename';
        process.env.APP_COOKIE_SECRET = 'testcookiesecret';
        process.env.APP_API_URL = 'http://find-tool.local';
        process.env.APP_DATABASE_URL = 'http://localhost:1234';
        process.env.OPENSEARCH_INDEX_CHUNKS_NAME = 'test_chunks';
        process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:4566';
        process.env.NODE_ENV = 'test';

        app = await createApp();
    });

    for (const route of routes) {
        it(`GET ${route.path} should return rendered HTML`, async () => {
            const res = await request(app).get(route.path);
            assert.equal(res.status, 200);
            assert.match(res.text, new RegExp(route.expected));
        });
    }
});
