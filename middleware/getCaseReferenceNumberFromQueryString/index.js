'use strict';

const getCaseReferenceNumberFromQueryString = (req, res, next) => {
    if (req.query.crn || req.query.caseReferenceNumber) {
        const crnRegex = /^[0-9]{2}-[0-9]{6}$/;
        const caseReferenceNumber = req.query.crn || req.query.caseReferenceNumber;

        if (crnRegex.test(caseReferenceNumber)) {
            req.session.caseSelected = true;
            req.session.caseReferenceNumber = caseReferenceNumber;
        }
    }

    next();
};

export {
    getCaseReferenceNumberFromQueryString
};
