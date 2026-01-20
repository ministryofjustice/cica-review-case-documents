import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import createPageMetadataRouter from './page-metadata-routes.js';

describe('API: Page Metadata Routes', () => {
  let app;
  let injectedHelperFactory;
  let injectedDalFactory;

  beforeEach(() => {
    // Minimal express app
    app = express();
    app.use(express.json());

    // Test logger
    app.use((req, _res, next) => {
      req.log = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
      next();
    });

    // Default injected helper returns deterministic metadata
    injectedHelperFactory = () => ({
      documentDAL: {},
      async getPageContent(documentId, pageNumber) {
        return {
          correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST',
          imageUrl: `s3://bucket/case/pages/${documentId}-${pageNumber}.png`,
          page_width: 1654,
          page_height: 2339,
          page_count: 42,
          text: 'example text'
        };
      }
    });

    // Default injected DAL yields correspondence type
    injectedDalFactory = () => ({
      async getPageMetadataByDocumentIdAndPageNumber(_documentId, _pageNumber) {
        return { correspondence_type: 'TC19 - ADDITIONAL INFO REQUEST' };
      }
    });

    app.use(
      '/api/document',
      createPageMetadataRouter({
        createPageContentHelper: injectedHelperFactory,
        createDocumentDAL: injectedDalFactory
      })
    );
  });

  it('GET /:documentId/page/:pageNumber/metadata returns combined metadata', async () => {
    const res = await request(app).get(
      '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-345678'
    );
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.data);
    assert.equal(res.body.data.page_width, 1654);
    assert.equal(res.body.data.page_height, 2339);
    assert.equal(res.body.data.page_count, 42);
    assert.equal(res.body.data.correspondence_type, 'TC19 - ADDITIONAL INFO REQUEST');
    assert.match(res.body.data.imageUrl, /s3:\/\/bucket/);
  });

  it('400 when crn is missing', async () => {
    const res = await request(app).get(
      '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata'
    );
    assert.equal(res.statusCode, 400);
    assert.ok(Array.isArray(res.body.errors));
  });

  it('404 when DAL returns no full metadata', async () => {
    // Re-mount with DAL returning null
    const dalNullFactory = () => ({
      async getPageMetadataByDocumentIdAndPageNumber() {
        return null;
      }
    });

    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, _res, next) => { req.log = { error: () => {}, info: () => {} }; next(); });
    testApp.use(
      '/api/document',
      createPageMetadataRouter({
        createPageContentHelper: injectedHelperFactory,
        createDocumentDAL: dalNullFactory
      })
    );

    const res = await request(testApp).get(
      '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-345678'
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

    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, _res, next) => { req.log = { error: () => {}, info: () => {} }; next(); });
    testApp.use(
      '/api/document',
      createPageMetadataRouter({
        createPageContentHelper: throwingHelperFactory,
        createDocumentDAL: injectedDalFactory
      })
    );

    const res = await request(testApp).get(
      '/api/document/123e4567-e89b-12d3-a456-426614174000/page/1/metadata?crn=12-345678'
    );
    assert.equal(res.statusCode, 500);
    assert.ok(Array.isArray(res.body.errors));
  });
});
