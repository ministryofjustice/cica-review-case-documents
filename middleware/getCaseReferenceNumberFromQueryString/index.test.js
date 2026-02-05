/**
 * Test suite for the getCaseReferenceNumberFromQueryString middleware.
 *
 * This suite verifies that the middleware correctly updates the session
 * based on the validity and presence of `crn` or `caseReferenceNumber`
 * query parameters, and always calls `next()`.
 *
 * Helper functions:
 * - deepMerge: Deeply merges two objects.
 * - getMockRequest: Generates a mock request object with merged properties.
 *
 * Constants:
 * - VALID_CRN: A valid case reference number string.
 * - INVALID_CRN: An invalid case reference number string.
 * - REQUESTS: Predefined mock request objects for various test scenarios.
 *
 * Test cases:
 * - Updates session when valid crn or caseReferenceNumber is provided.
 * - Does not update session when invalid crn or caseReferenceNumber is provided.
 * - Handles combinations of valid/invalid crn and caseReferenceNumber.
 * - Does not update session when neither crn nor caseReferenceNumber is provided.
 * - Ensures next() is called on every middleware invocation.
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';

import getCaseReferenceNumberFromQueryString from './index.js';

/**
 * Deeply merges two objects. Properties from the second object will overwrite those in the first object.
 * If both properties are objects, they are merged recursively.
 *
 * @param {Object} obj1 - The target object to merge into.
 * @param {Object} obj2 - The source object whose properties will be merged into obj1.
 * @returns {Object} A new object resulting from the deep merge of obj1 and obj2.
 */
function deepMerge(obj1, obj2) {
    const result = { ...obj1 };
    for (const key in obj2) {
        if (Object.hasOwn(obj2, key)) {
            if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
                result[key] = deepMerge(obj1[key], obj2[key]);
            } else {
                result[key] = obj2[key];
            }
        }
    }
    return result;
}

/**
 * Creates a mock request object by deeply merging provided property objects into a base request structure.
 *
 * @param {...Object} propsToMerge - Objects containing properties to merge into the base request.
 * @returns {Object} The resulting mock request object with merged properties.
 */
function getMockRequest(...propsToMerge) {
    const baseReq = {
        query: {},
        session: {}
    };

    const mergedProps = JSON.parse(
        JSON.stringify(
            propsToMerge.reduce((merged, propsObject) => {
                merged = deepMerge(merged, propsObject);
                return merged;
            }, baseReq)
        )
    );

    return mergedProps;
}
const VALID_CRN = '25-723456';
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
                query: {}
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
        const req = getMockRequest(
            REQUESTS.QUERY.VALID.CRN,
            REQUESTS.QUERY.VALID.CASEREFERENCENUMBER
        );
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should update the session when a valid crn and an invalid caseReferenceNumber are provided', () => {
        const req = getMockRequest(
            REQUESTS.QUERY.VALID.CRN,
            REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER
        );
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should update the session when an invalid crn and a valid caseReferenceNumber are provided', () => {
        const req = getMockRequest(
            REQUESTS.QUERY.INVALID.CRN,
            REQUESTS.QUERY.VALID.CASEREFERENCENUMBER
        );
        getCaseReferenceNumberFromQueryString(req, {}, () => {});
        assert.equal(req.session.caseSelected, true);
        assert.equal(req.session.caseReferenceNumber, VALID_CRN);
    });

    it('Should not update the session when an invalid crn and caseReferenceNumber are provided', () => {
        const req = getMockRequest(
            REQUESTS.QUERY.INVALID.CRN,
            REQUESTS.QUERY.INVALID.CASEREFERENCENUMBER
        );
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
        const nextMock = () => {
            nextCallCount += 1;
        };

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

        allRequests.forEach((req) => {
            getCaseReferenceNumberFromQueryString(req, {}, nextMock);
        });

        assert.equal(
            nextCallCount,
            allRequests.length,
            'next() should be called once per middleware invocation'
        );
    });
});
