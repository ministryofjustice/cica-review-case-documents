import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import createTemplateEngineService from '../../templateEngine/index.js';

const createRenderer = () => {
    const app = express();
    const templateEngineService = createTemplateEngineService(app);
    templateEngineService.init();
    return templateEngineService;
};

describe('search page templates', () => {
    const baseResultsContext = {
        caseSelected: true,
        caseReferenceNumber: '12-745678',
        pageType: 'search',
        csrfToken: 'csrf-token',
        cspNonce: 'nonce',
        userName: 'search.user@example.com',
        query: 'jaw fracture',
        searchType: 'semantic',
        searchTerm: 'jaw fracture',
        showPaginationItems: true,
        pagination: {
            totalItemCount: 3,
            totalPageCount: 3,
            currentPageIndex: 2,
            itemsPerPage: 1,
            from: 2,
            to: 2,
            isFirstPage: false,
            isLastPage: false
        }
    };

    it('renders the search index form with the current search type as a hidden input', () => {
        const html = createRenderer().render('search/page/index.njk', {
            caseSelected: true,
            caseReferenceNumber: '12-745678',
            pageType: 'search',
            csrfToken: 'csrf-token',
            cspNonce: 'nonce',
            userName: 'search.user@example.com',
            searchType: 'semantic'
        });

        assert.match(html, /name="type" value="semantic"/);
    });

    it('renders results links and pagination with the current search type preserved', () => {
        const html = createRenderer().render('search/page/results.njk', {
            ...baseResultsContext,
            searchResults: [
                {
                    docUuid: 'doc-123',
                    searchTerm: 'jaw fracture',
                    searchType: 'semantic',
                    caseReferenceNumber: '12-745678',
                    _source: {
                        correspondence_type: 'Medical report',
                        source_file_name: 'report.pdf',
                        chunk_text: 'Result snippet',
                        page_number: 3,
                        received_date: '2026-01-12T00:00:00Z'
                    }
                }
            ]
        });

        assert.match(html, /name="type" value="semantic"/);
        assert.match(
            html,
            /\/search\/\?query=jaw%20fracture&amp;pageNumber=1&amp;crn=12-745678&amp;type=semantic/
        );
        assert.match(
            html,
            /\/search\/\?query=jaw%20fracture&amp;pageNumber=3&amp;crn=12-745678&amp;type=semantic/
        );
        assert.match(
            html,
            /\/document\/doc-123\/view\/page\/3\?crn=12-745678&searchTerm=jaw%20fracture&type=semantic/
        );
    });

    it('renders result-level debug tags and relevance score when debug feature flag is enabled', () => {
        const html = createRenderer().render('search/page/results.njk', {
            ...baseResultsContext,
            searchResults: [
                {
                    docUuid: 'doc-123',
                    searchTerm: 'jaw fracture',
                    searchType: 'semantic',
                    isDebugMode: true,
                    caseReferenceNumber: '12-745678',
                    featureFlags: {
                        debug: true
                    },
                    matchSources: ['keyword', 'semantic', 'dates', 'unknown'],
                    _score: 9.42,
                    _source: {
                        correspondence_type: 'Medical report',
                        source_file_name: 'report.pdf',
                        chunk_text: 'Result snippet',
                        page_number: 3,
                        received_date: '2026-01-12T00:00:00Z'
                    }
                }
            ]
        });

        assert.match(html, /search-result-debug/);
        assert.match(html, /govuk-tag govuk-tag--blue">Keyword<\/strong>/);
        assert.match(html, /govuk-tag govuk-tag--turquoise">Semantic<\/strong>/);
        assert.match(html, /govuk-tag govuk-tag--red">Dates<\/strong>/);
        assert.doesNotMatch(html, />unknown</);
        assert.match(html, /Relevance score:\s*9\.42/);
    });

    it('does not render result-level debug metadata when debug feature flag is disabled', () => {
        const html = createRenderer().render('search/page/results.njk', {
            ...baseResultsContext,
            searchResults: [
                {
                    docUuid: 'doc-123',
                    searchTerm: 'jaw fracture',
                    searchType: 'semantic',
                    isDebugMode: false,
                    caseReferenceNumber: '12-745678',
                    featureFlags: {
                        debug: false
                    },
                    matchSources: ['keyword', 'semantic', 'dates'],
                    _score: 9.42,
                    _source: {
                        correspondence_type: 'Medical report',
                        source_file_name: 'report.pdf',
                        chunk_text: 'Result snippet',
                        page_number: 3,
                        received_date: '2026-01-12T00:00:00Z'
                    }
                }
            ]
        });

        assert.doesNotMatch(html, /search-result-debug/);
        assert.doesNotMatch(html, /Relevance score:/);
    });
});
