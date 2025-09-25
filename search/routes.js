'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    return res.render('search/page/index.njk', {
        csrfToken: res.locals.csrfToken,
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'search'
    });
});

router.post('/', (req, res) => {
    const query = req.body.q;
    return res.redirect(`/search/${query}`);
});

router.get('/:query', (req, res) => {
    return res.redirect(`/search/${req.params.query}/page/1`);
});

router.get('/:query/page/:page', (req, res) => {
    const resultsResource = [
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_1111111111',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_22222222222222',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_3333333333333333',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'def123',
            ingested_doc_id: '09fadbkfsdaofiasdyf9dastf',
            chunk_text: 'I reviewed John Smith in the ENT treatment room today after he was referred with post traumatic tinnitus\n\nJohn Smith was allegedly assaulted 6 days ago and was punched on the left side of his face',
            source_file_name: 'tc19_444444444444444',
            page_count: 20,
            page_number: 12,
            chunk_index: 70,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '99.99999999',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_555555555555555',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_6666666666666',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_7777777777777777777',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'def123',
            ingested_doc_id: '09fadbkfsdaofiasdyf9dastf',
            chunk_text: 'I reviewed John Smith in the ENT treatment room today after he was referred with post traumatic tinnitus\n\nJohn Smith was allegedly assaulted 6 days ago and was punched on the left side of his face',
            source_file_name: 'tc19_888888888888888',
            page_count: 20,
            page_number: 12,
            chunk_index: 70,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '99.99999999',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_999999999999999',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_10-10-10-10-10',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_11-11-11-11-11',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'def123',
            ingested_doc_id: '09fadbkfsdaofiasdyf9dastf',
            chunk_text: 'I reviewed John Smith in the ENT treatment room today after he was referred with post traumatic tinnitus\n\nJohn Smith was allegedly assaulted 6 days ago and was punched on the left side of his face',
            source_file_name: 'tc19_12-12-12-12-12',
            page_count: 20,
            page_number: 12,
            chunk_index: 70,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '99.99999999',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_13-13-13-13-13',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_14-14-14-14-14',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_15-15-15-15-15',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'def123',
            ingested_doc_id: '09fadbkfsdaofiasdyf9dastf',
            chunk_text: 'I reviewed John Smith in the ENT treatment room today after he was referred with post traumatic tinnitus\n\nJohn Smith was allegedly assaulted 6 days ago and was punched on the left side of his face',
            source_file_name: 'tc19_16-16-16-16-16',
            page_count: 20,
            page_number: 12,
            chunk_index: 70,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '99.99999999',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_17-17-17-17-17',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_18-18-18-18-18',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_19-19-19-19-19',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'def123',
            ingested_doc_id: '09fadbkfsdaofiasdyf9dastf',
            chunk_text: 'I reviewed John Smith in the ENT treatment room today after he was referred with post traumatic tinnitus\n\nJohn Smith was allegedly assaulted 6 days ago and was punched on the left side of his face',
            source_file_name: 'tc19_20-20-20-20-20',
            page_count: 20,
            page_number: 12,
            chunk_index: 70,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '99.99999999',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc123',
            ingested_doc_id: 'safsdfdilbqwgco3o21gc312y32c327g',
            chunk_text: '[X] assault 6 days ago. Punched in the face',
            source_file_name: 'tc19_21-21-21-21-21',
            page_count: 20,
            page_number: 2,
            chunk_index: 31,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '97.2837324623',
            bounding_box: {
                top: 100,
                left: 250,
                right: 300,
                bottom: 600
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc456',
            ingested_doc_id: 'dsan43925y3tgwrt892345igwt',
            chunk_text: `Consultation Assault Sept 2019. He had his nose broken and he lost conciousness for a while.\n\nBackache worsening since being assaulted last week`,
            source_file_name: 'tc19_22-22-22-22-22',
            page_count: 20,
            page_number: 3,
            chunk_index: 98,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '94.0852',
            bounding_box: {
                top: 200,
                left: 150,
                right: 200,
                bottom: 500
            },
            case_ref: '24/123456',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        },
        {
            chunk_id: 'abc789',
            ingested_doc_id: 'onyu98ty34g54895tqw4712hui',
            chunk_text: 'bilateral tinnitus following an assault on 13th January, 2023\n\nthe assault no significant change in hearing\n\nissues with tinnitus bilaterally following an assault',
            source_file_name: 'tc19_23-23-23-23-23',
            page_count: 20,
            page_number: 7,
            chunk_index: 2,
            chunk_type: 'SOME_LAYOUT_TYPE',
            confidence: '91.76328432',
            bounding_box: {
                top: 50,
                left: 50,
                right: 400,
                bottom: 900
            },
            case_ref: '24/657212',
            received_date: '2024-06-04T11:19:13+00:00',
            correspondence_type: 'SOME_CORRESPONDENCE_TYPE'
        }
    ];

    const totalResultsLength = resultsResource.length;
    const totalPageCount = Math.ceil(resultsResource.length / process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE);

    let currentPage = Number(req.params.page);

    if (currentPage < 1 || isNaN(currentPage)) {
        return res.redirect(`/search/${req.params.query}/page/1`);
    }

    if (currentPage > totalPageCount) {
        return res.redirect(`/search/${req.params.query}/page/${totalPageCount}`);
    }
    const from = (currentPage - 1) * process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * process.env.CRDC_SEARCH_PAGINATION_ITEMS_PER_PAGE, resultsResource.length);

    return res.render('search/page/results.njk', {
        caseSelected: req.session.caseSelected,
        caseData: req.session.caseData,
        pageType: 'search',
        query: req.params.query,
        pagination: {
            itemCount: totalResultsLength,
            pageCount: totalPageCount,
            currentPage: currentPage,
            from,
            to,
            firstPage: currentPage <= 1,
            lastPage: currentPage >= totalPageCount
        },
        searchResults: resultsResource.slice(from - 1, to) // should include pagination data at this point, either determined locally, or at the "server" level.
    });
});

export default router;
