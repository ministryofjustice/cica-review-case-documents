'use strict';

import { describe, it, before, after} from 'node:test';
import assert from 'node:assert';

import getCaseReferenceNumberFromQueryString from './index.js';

function deepMerge(obj1, obj2) {
    const result = { ...obj1 };
    for (let key in obj2) {
        if (obj2.hasOwnProperty(key)) {
            if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
                result[key] = deepMerge(obj1[key], obj2[key]);
            } else {
                result[key] = obj2[key];
            }
        }
    }
    return result;
}

function getMockRequest(...propsToMerge) {
    const baseReq = {
        query: {},
        session: {}
    };

    const mergedProps = JSON.parse(JSON.stringify(propsToMerge.reduce((merged, propsObject) => {
        merged = deepMerge(merged, propsObject);
        return merged;
    }, baseReq)));

    return mergedProps;
}
const VALID_CRN = '25-123456';
const INVALID_CRN = 'some invalid crn';
const REQUESTS = {
    QUERY: {
        VALID: {
            CRN: {
                query: {
                    crn: VALID_CRN
                }
            },
            CASEREFERENCENUMBER: {
                query: {
                    caseReferenceNumber: VALID_CRN
                }
            },
            NONE: {
                query: {

                }
            }
        },
        INVALID: {
            CRN: {
                query: {
                    crn: INVALID_CRN
                }
            },
            CASEREFERENCENUMBER: {
                query: {
                    caseReferenceNumber: INVALID_CRN
                }
            }
        }
    }
};

describe('getCaseReferenceNumberFromQueryString', () => {
    it('Should update the session when a valid crn is provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.VALID.CRN);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should update the session when a valid caseReferenceNumber is provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.VALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should not update the session when an invalid crn is provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.INVALID.CRN);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, undefined);
        assert.equal(req.session.caseReferenceNumber, undefined);
    });

    it('Should not update the session when an invalid caseReferenceNumber is provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, undefined);
        assert.equal(req.session.caseReferenceNumber, undefined);
    });

    it('Should update the session when a valid crn and a valid caseReferenceNumber are provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.VALID.CRN, REQUESTS.QUERY.VALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should update the session when a valid crn and an invalid caseReferenceNumber are provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.VALID.CRN, REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should update the session when an invalid crn and a valid caseReferenceNumber are provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.INVALID.CRN, REQUESTS.QUERY.VALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should not update the session when an invalid crn and caseReferenceNumber are provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.INVALID.CRN, REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, undefined);
        assert.equal(req.session.caseReferenceNumber, undefined);
    });

    it('Should not update the session when a crn and caseReferenceNumber are not provided', () => {
        const req = getMockRequest(REQUESTS.QUERY.VALID.NONE);
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, undefined);
        assert.equal(req.session.caseReferenceNumber, undefined);
    });

    it('Should call next() every time the middleware runs', () => {
        let nextCallCount = 0;
        const nextMock = () => { nextCallCount += 1 };
    
        const allRequests = [
            getMockRequest(REQUESTS.QUERY.VALID.CRN),
            getMockRequest(REQUESTS.QUERY.VALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.INVALID.CRN),
            getMockRequest(REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.VALID.CRN, REQUESTS.QUERY.VALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.VALID.CRN, REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.INVALID.CRN, REQUESTS.QUERY.VALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.INVALID.CRN, REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER),
            getMockRequest(REQUESTS.QUERY.VALID.NONE)
        ];
    
        allRequests.forEach(req => {
            getCaseReferenceNumberFromQueryString(req, {}, nextMock);
        });
    
        assert.equal(nextCallCount, allRequests.length, 'next() should be called once per middleware invocation');
    });
});
