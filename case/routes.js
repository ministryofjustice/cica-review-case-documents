'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.render('case/page/index.njk', {
        csrfToken: res.locals.csrfToken
    });
});

router.post('/', (req, res) => {
    const crnPrefix = req.body['crn-prefix'];
    const crnSuffix = req.body['crn-suffix'];
    res.redirect(`/case/${crnPrefix}/${crnSuffix}`);
});

router.get('/:crnPrefix/:crnSuffix', (req, res) => {
    const resultsResource = [
        {
            case_ref: '23/123456',
            applicant: {
                name: 'Mr John Doe'
            },
            creation_date: '2024-06-04T11:19:13+00:00',
            documents: [
                {
                    url: 'http://amazonbucket.com/document/1'
                },
                {
                    url: 'http://amazonbucket.com/document/2'
                },
                {
                    url: 'http://amazonbucket.com/document/3'
                },
                {
                    url: 'http://amazonbucket.com/document/4'
                },
            ]
        }
    ];

    return res.render('case/page/results.njk', {
        caseReference: resultsResource[0].case_ref,
        applicantName: resultsResource[0].applicant.name,
        creationDate: resultsResource[0].creation_date,
        documents: resultsResource[0].documents,
        documentsCount: resultsResource[0].documents.length
    });
});

export default router;
