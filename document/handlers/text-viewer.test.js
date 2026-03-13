import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getApiJwtAudience, getApiJwtIssuer } from '../../auth/utils/apiJwtClaims/index.js';
import { buildPageMetadataFixture } from '../../test/fixtures/page-metadata.js';
import { createTextViewerHandler } from './text-viewer.js';

const createPageChunksServiceWithoutHighlights = () => ({
    getPageChunks: async () => []
});

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
            createPageChunksServiceWithoutHighlights,
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
            cookies: { jwtToken: 'test-jwt' },
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
        assert.deepEqual(renderParams.pageTextSegments, [
            { text: 'Resolved metadata text', isHighlight: false }
        ]);
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
            createPageChunksServiceWithoutHighlights,
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
            createPageChunksServiceWithoutHighlights,
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
            cookies: { jwtToken: 'test-jwt' },
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
        assert.deepEqual(
            {
                ...metadataFactoryArgs,
                jwtToken: undefined
            },
            {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678',
                jwtToken: undefined,
                logger: req.log
            }
        );
        assert.equal(typeof metadataFactoryArgs.jwtToken, 'string');
        assert.ok(metadataFactoryArgs.jwtToken.length > 0);
        assert.equal(renderCallCount, 1);
        assert.equal(renderView, 'document/page/textview.njk');
        assert.equal(sentHtml, renderOutput);
        assert.equal(renderParams.pageText, 'No text content available for this page.');
        assert.deepEqual(renderParams.pageTextSegments, [
            { text: 'No text content available for this page.', isHighlight: false }
        ]);
        assert.equal(result, sendResult);
    });

    it('provides highlighted text segments when searchTerm is present', async () => {
        let renderParams;
        let capturedChunkServiceArgs;

        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            text: 'The claimant was seen on 12/12/1995 and again on 12/12/1995.'
                        }
                    })
            }),
            (args) => {
                capturedChunkServiceArgs = args;
                return {
                    getPageChunks: async () => [
                        { chunk_text: '12/12/1995 and again', chunk_index: 0 },
                        { chunk_text: 'again on 12/12/1995', chunk_index: 1 }
                    ]
                };
            },
            () => ({
                render: (_view, params) => {
                    renderParams = params;
                    return 'render-output-highlight';
                }
            })
        );

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678'
            },
            query: {
                searchTerm: '12/12/1995'
            },
            session: { caseSelected: true },
            cookies: { jwtToken: 'test-jwt' },
            log: { error: () => {} }
        };

        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: () => 'send-result-highlight'
        };

        await handler(req, res, () => {});

        assert.deepEqual(
            {
                ...capturedChunkServiceArgs,
                jwtToken: undefined
            },
            {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678',
                searchTerm: '12/12/1995',
                jwtToken: undefined,
                logger: req.log
            }
        );
        assert.equal(typeof capturedChunkServiceArgs.jwtToken, 'string');
        assert.ok(capturedChunkServiceArgs.jwtToken.length > 0);
        assert.notEqual(capturedChunkServiceArgs.jwtToken, 'test-jwt');
        const [header, payload] = capturedChunkServiceArgs.jwtToken.split('.');
        assert.ok(header);
        assert.ok(payload);
        assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), {
            username: 'app-ui',
            iat: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).iat,
            exp: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp,
            aud: getApiJwtAudience(),
            iss: getApiJwtIssuer()
        });

        assert.deepEqual(renderParams.pageTextSegments, [
            { text: 'The claimant was seen on ', isHighlight: false },
            { text: '12/12/1995 and again on 12/12/1995', isHighlight: true },
            { text: '.', isHighlight: false }
        ]);
    });

    it('logs and calls next when page chunk retrieval fails', async () => {
        const pageChunksError = new Error('page chunks unavailable');

        let loggedContext;
        let loggedMessage;
        let renderCalled = false;
        let sendCalled = false;

        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            text: 'Some text'
                        }
                    })
            }),
            () => ({
                getPageChunks: async () => {
                    throw pageChunksError;
                }
            }),
            () => ({
                render: () => {
                    renderCalled = true;
                    return 'render-output-page-chunks-failure';
                }
            })
        );

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 7,
                crn: '26-745678'
            },
            query: {
                searchTerm: '  gabapentin  '
            },
            session: { caseSelected: true },
            cookies: { jwtToken: 'test-jwt' },
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

        assert.equal(nextError, pageChunksError);
        assert.deepEqual(loggedContext, {
            error: pageChunksError.message,
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            pageNumber: 7,
            searchTerm: 'gabapentin'
        });
        assert.equal(loggedMessage, 'Failed to retrieve document page chunks for text highlights');
        assert.equal(renderCalled, false);
        assert.equal(sendCalled, false);
        assert.equal(result, nextResult);
    });

    it('does not request chunks when searchTerm is blank', async () => {
        let getPageChunksCalls = 0;

        const handler = createTextViewerHandler(
            () => ({
                getPageMetadata: async () =>
                    buildPageMetadataFixture({
                        overrides: {
                            text: 'Some text'
                        }
                    })
            }),
            () => ({
                getPageChunks: async () => {
                    getPageChunksCalls += 1;
                    return [];
                }
            }),
            () => ({
                render: () => 'render-output-no-search-term'
            })
        );

        const req = {
            validatedParams: {
                documentId: '123e4567-e89b-12d3-a456-426614174000',
                pageNumber: 1,
                crn: '26-745678'
            },
            query: {
                searchTerm: '   '
            },
            session: { caseSelected: true },
            cookies: { jwtToken: 'test-jwt' },
            log: { error: () => {} }
        };

        const res = {
            locals: { csrfToken: 'csrf-token', cspNonce: 'nonce' },
            send: () => 'send-result-no-search-term'
        };

        await handler(req, res, () => {});

        assert.equal(getPageChunksCalls, 0);
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
            createPageChunksServiceWithoutHighlights,
            () => ({ render: () => 'render-output-outer-catch' })
        );

        const req = {
            query: {},
            session: { caseSelected: true },
            cookies: { jwtToken: 'test-jwt' },
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
            createPageChunksServiceWithoutHighlights,
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
            cookies: { jwtToken: 'test-jwt' },
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
