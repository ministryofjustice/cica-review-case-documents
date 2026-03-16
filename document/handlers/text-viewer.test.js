import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPageMetadataFixture } from '../../test/fixtures/page-metadata.js';
import { createTextViewerHandler } from './text-viewer.js';

describe('Text Viewer Handler', () => {
    it('renders successfully when metadata retrieval succeeds', async () => {
        let renderParams;
        const renderOutput = 'render-output-success';
        const sendResult = { ok: true };
        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            text: 'Resolved metadata text',
                            page_num: 2,
                            page_count: 3
                        }
                    })
            }),
            () => ({
                render: (_view, params) => {
                    renderParams = params;
                    return renderOutput;
                }
            })
        );

        let sentHtml;
        let errorLogged = false;

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 7,
                crn: '26-745678'
            },
            query: {},
            session: { caseSelected: true },
            log: {
                error: () => {
                    errorLogged = true;
                }
            }
        };

        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: (html) => {
                sentHtml = html;
                return sendResult;
            }
        };

        let nextError;
        const next = (error) => {
            nextError = error;
        };

        const result = await handler(req, res, next);

        assert.equal(nextError, undefined);
        assert.equal(errorLogged, false);
        assert.equal(sentHtml, renderOutput);
        assert.equal(renderParams.pageText, 'Resolved metadata text');
        assert.equal(renderParams.showPagination, true);
        assert.equal(renderParams.paginationData?.results?.count, 3);
        assert.equal(
            renderParams.paginationData?.items?.[0]?.href,
            '/document/123e4567-e89b-12d3-a456-426614174000/view/text/page/1?crn=26-745678'
        );
        assert.equal(
            renderParams.paginationData?.previous?.href,
            '/document/123e4567-e89b-12d3-a456-426614174000/view/text/page/1?crn=26-745678'
        );
        assert.equal(
            renderParams.paginationData?.next?.href,
            '/document/123e4567-e89b-12d3-a456-426614174000/view/text/page/3?crn=26-745678'
        );
        assert.equal(result, sendResult);
    });

    it('sets showPagination false when metadata contains a single page', async () => {
        let renderParams;

        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            page_num: 1,
                            page_count: 1
                        }
                    })
            }),
            () => ({
                render: (_view, params) => {
                    renderParams = params;
                    return 'render-output-single-page';
                }
            })
        );

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678'
            },
            query: {},
            session: { caseSelected: true },
            cookies: { jwtToken: 'test-jwt' },
            log: { error: () => {} }
        };

        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: () => 'send-result-single-page'
        };

        await handler(req, res, () => {});

        assert.equal(renderParams.showPagination, false);
        assert.equal(renderParams.paginationData?.results?.count, 1);
    });

    it('uses fallback page text when metadata text is empty', async () => {
        let metadataFactoryArgs;
        let renderView;
        let renderParams;
        let renderCallCount = 0;
        const renderOutput = 'render-output-fallback';
        const sendResult = { sent: true };

        const createTemplateEngineServiceFactory = () => ({
            render: (view, params) => {
                renderCallCount += 1;
                renderView = view;
                renderParams = params;
                return renderOutput;
            }
        });

        const createMetadataServiceFactory = (args) => {
            metadataFactoryArgs = args;
            return {
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            text: ''
                        }
                    })
            };
        };

        const handler = createTextViewerHandler(
            createMetadataServiceFactory,
            createTemplateEngineServiceFactory
        );

        let sentHtml;
        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678'
            },
            query: {},
            session: { caseSelected: true },
            log: { error: () => {} }
        };
        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: (html) => {
                sentHtml = html;
                return sendResult;
            }
        };

        let nextError;
        const next = (error) => {
            nextError = error;
        };

        const result = await handler(req, res, next);

        assert.equal(nextError, undefined);
        assert.equal(metadataFactoryArgs.documentId, '123e4567-e89b-12d3-a456-426614174000');
        assert.equal(metadataFactoryArgs.pageNumber, 1);
        assert.equal(metadataFactoryArgs.crn, '26-745678');
        assert.equal(typeof metadataFactoryArgs.jwtToken, 'string');
        assert.ok(metadataFactoryArgs.jwtToken.length > 0);
        assert.equal(metadataFactoryArgs.logger, req.log);
        assert.equal(renderCallCount, 1);
        assert.equal(renderView, 'document/page/textview.njk');
        assert.equal(sentHtml, renderOutput);
        assert.equal(renderParams.pageText, 'No text content available for this page.');
        assert.equal(result, sendResult);
    });

    it('calls next with outer catch error when validated params are missing', async () => {
        let metadataFactoryCalled = false;
        const handler = createTextViewerHandler(
            () => {
                metadataFactoryCalled = true;
                return {
                    getPageMetadata: async () =>
                        buildPageMetadataFixture({
                            overrides: {
                                correspondence_type: 'SHOULD NOT BE USED'
                            }
                        })
                };
            },
            () => ({ render: () => 'render-output-outer-catch' })
        );

        const req = {
            query: {},
            session: { caseSelected: true },
            log: { error: () => {} }
        };
        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: () => {}
        };

        let nextError;
        const nextResult = { nextCalled: true };
        const next = (error) => {
            nextError = error;
            return nextResult;
        };

        const result = await handler(req, res, next);

        assert.ok(nextError instanceof Error);
        assert.equal(metadataFactoryCalled, false);
        assert.equal(result, undefined);
    });

    it('logs and calls next when metadata retrieval fails', async () => {
        const metadataError = new Error('metadata service unavailable');

        let loggedContext;
        let loggedMessage;
        let renderCalled = false;
        let sendCalled = false;

        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () => {
                    throw metadataError;
                }
            }),
            () => ({
                render: () => {
                    renderCalled = true;
                    return 'render-output-metadata-failure';
                }
            })
        );

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 7,
                crn: '26-745678'
            },
            query: {},
            session: { caseSelected: true },
            log: {
                error: (context, message) => {
                    loggedContext = context;
                    loggedMessage = message;
                }
            }
        };
        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: () => {
                sendCalled = true;
            }
        };

        let nextError;
        const nextResult = { nextCalled: true };
        const next = (error) => {
            nextError = error;
            return nextResult;
        };

        const result = await handler(req, res, next);

        assert.equal(nextError, metadataError);
        assert.deepEqual(loggedContext, {
            error: metadataError.message,
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 7
        });
        assert.equal(loggedMessage, 'Failed to retrieve page metadata from API');
        assert.equal(renderCalled, false);
        assert.equal(sendCalled, false);
        assert.equal(result, nextResult);
    });
});
