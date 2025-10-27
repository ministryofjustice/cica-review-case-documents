'use strict';

import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {

    // if (req.session.caseSelected) {
    //     return res.redirect(`case/${req.session.caseData.case_ref}`);
    // }

    return res.render('case/page/index.njk', {
        csrfToken: res.locals.csrfToken,
        // caseSelected: req.session.caseSelected,
        // caseData: req.session.caseData,
        pageType: ['case']
    });
});

router.get('/clear', (req, res) => {
    delete req.session.caseSelected;
    delete req.session.caseReferenceNumber;

    return res.redirect('/case');
});

router.post('/', (req, res) => {
    const crnPrefix = req.body['crn-prefix'];
    const crnSuffix = req.body['crn-suffix'];
    return res.redirect(`/case/${crnPrefix}/${crnSuffix}`);
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
                    name: 'TC19',
                    url: 'http://amazonbucket.com/document/1'
                },
                {
                    name: 'TX01',
                    url: 'http://amazonbucket.com/document/2'
                },
                {
                    name: 'AR93',
                    url: 'http://amazonbucket.com/document/3'
                },
                {
                    name: 'ZE14',
                    url: 'http://amazonbucket.com/document/4'
                },
            ]
        }
    ];

    req.session.caseSelected = true;
    req.session.caseData = JSON.parse(JSON.stringify(resultsResource[0]));

    return res.render('case/page/results.njk', {
        // caseData: req.session.caseData,
        // caseSelected: req.session.caseSelected,
        pageType: ['case'],
        crnPrefix: req.params['crnPrefix'],
        crnSuffix: req.params['crnSuffix'],
        // dummy data from here down.
        // caseReference: resultsResource[0].case_ref,
        // applicantName: resultsResource[0].applicant.name,
        // creationDate: resultsResource[0].creation_date,
        // documents: resultsResource[0].documents,
        // documentsCount: resultsResource[0].documents.length
    });
});

export default router;
