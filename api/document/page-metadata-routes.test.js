import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { buildPageMetadataFixture } from '../../test/fixtures/page-metadata.js';
import errorHandler from '../middleware/errorHandler/index.js';
import createPageMetadataRouter from './page-metadata-routes.js';

describe('API: Page Metadata Routes', () => {
    let app;
    let injectedHelperFactory;
    let injectedDalFactory;

    /**
     * Builds a test Express app with page metadata router and error handler.
     *
     * @param {Object} options - Configuration for test app.
     * @param {Function} options.createPageContentHelper - Factory for page content helper.
     * @param {Function} options.createDocumentDAL - Factory for document DAL.
     * @returns {express.Application} Configured test Express app.
     */
    function buildTestApp({ createPageContentHelper, createDocumentDAL }) {
        const testApp = express();
        testApp.use(express.json());

        testApp.use((req, _res, next) => {
            req.log = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
            next();
        });

        testApp.use(
            '/api/document',
            createPageMetadataRouter({
                createPageContentHelper,
                createDocumentDAL
            })
        );

        testApp.use(errorHandler);
        return testApp;
    }

    beforeEach(() => {
        // Default injected helper returns deterministic metadata
        injectedHelperFactory = () => ({
            documentDAL: {},
            async getPageContent(documentId, pageNumber) {
                return buildPageMetadataFixture({
                    overrides: {
                        page_count: 42,
                        page_num: 7,
                        imageUrl: `s3://bucket/case/pages/${documentId}-${pageNumber}.png`,
                        text: 'example text'
                    }
                });
            }
        });

        // Default injected DAL yields correspondence type
        injectedDalFactory = () => ({
            async getPageMetadataByDocumentIdAndPageNumber(_documentId, _pageNumber) {
                return buildPageMetadataFixture({
                    omit: ['page_count', 'page_num', 'imageUrl', 'text']
                });
            }
        });

        app = buildTestApp({
            createPageContentHelper: injectedHelperFactory,
            createDocumentDAL: injectedDalFactory
        });
    });

    it('GET /:documentId/page/:pageNumber/metadata returns combined metadata', async () => {
        const res = await request(app).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 200);
        assert.ok(res.body.data);
        assert.equal(res.body.data.correspondence_type, 'TC19 - ADDITIONAL INFO REQUEST');
        assert.equal(res.body.data.page_count, 42);
        assert.equal(res.body.data.page_num, 1);
        assert.match(res.body.data.imageUrl, /s3:\/\/bucket/);
    });

    it('400 when crn is missing', async () => {
        const res = await request(app).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata'
        );
        assert.equal(res.statusCode, 400);
        assert.ok(Array.isArray(res.body.errors));
    });

    it('400 when crn has invalid format', async () => {
        const res = await request(app).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=invalid-crn'
        );
        assert.equal(res.statusCode, 400);
        assert.ok(Array.isArray(res.body.errors));
        assert.equal(res.body.errors[0].detail, 'Invalid case reference number');
    });

    it('404 when DAL returns no full metadata', async () => {
        // Re-mount with DAL returning null
        const dalNullFactory = () => ({
            async getPageMetadataByDocumentIdAndPageNumber() {
                return null;
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: injectedHelperFactory,
            createDocumentDAL: dalNullFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 404);
    });

    it('500 when helper throws', async () => {
        const throwingHelperFactory = () => ({
            async getPageContent() {
                const err = new Error('Simulated OpenSearch error');
                err.status = 500;
                throw err;
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: throwingHelperFactory,
            createDocumentDAL: injectedDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 500);
        assert.ok(Array.isArray(res.body.errors));
    });

    it('404 when helper returns null page metadata', async () => {
        const helperNullFactory = () => ({
            async getPageContent() {
                return null;
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: helperNullFactory,
            createDocumentDAL: injectedDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 404);
        assert.ok(Array.isArray(res.body.errors));
        assert.equal(res.body.errors[0].detail, 'Page metadata not found');
    });

    it('404 when helper throws 404 error', async () => {
        const throwingHelperFactory = () => ({
            async getPageContent() {
                const err = new Error('Document not found');
                err.status = 404;
                throw err;
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: throwingHelperFactory,
            createDocumentDAL: injectedDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 404);
        assert.ok(Array.isArray(res.body.errors));
        assert.equal(res.body.errors[0].title, 'Not Found');
    });

    it('500 when DAL throws error', async () => {
        const throwingDalFactory = () => ({
            async getPageMetadataByDocumentIdAndPageNumber() {
                throw new Error('Database connection failed');
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: injectedHelperFactory,
            createDocumentDAL: throwingDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 500);
        assert.ok(Array.isArray(res.body.errors));
        assert.equal(res.body.errors[0].detail, 'Database connection failed');
    });

    it('500 when outer try-catch catches unexpected error', async () => {
        const helperFactoryThatThrowsUnexpected = () => {
            throw new Error('Unexpected initialization error');
        };

        const testApp = buildTestApp({
            createPageContentHelper: helperFactoryThatThrowsUnexpected,
            createDocumentDAL: injectedDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 500);
        assert.ok(Array.isArray(res.body.errors));
    });

    it('returns 500 when helper throws error without status code (line 88 fallback)', async () => {
        const throwingHelperFactory = () => ({
            async getPageContent() {
                throw new Error('OpenSearch error without status');
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: throwingHelperFactory,
            createDocumentDAL: injectedDalFactory
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.errors[0].title, 'Internal Server Error');
    });

    it('returns null correspondence_type when DAL returns metadata without it (line 146)', async () => {
        const dalFactoryNoCorrespondence = () => ({
            async getPageMetadataByDocumentIdAndPageNumber() {
                return {}; // No correspondence_type property
            }
        });

        const testApp = buildTestApp({
            createPageContentHelper: injectedHelperFactory,
            createDocumentDAL: dalFactoryNoCorrespondence
        });

        const res = await request(testApp).get(
            '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-745678'
        );
        assert.equal(res.statusCode, 200);
        assert.strictEqual(res.body.data.correspondence_type, null);
    });
});
