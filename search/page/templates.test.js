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
            ],
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
});
