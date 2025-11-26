/**
 * Middleware to extract and validate a case reference number from the query string.
 * Accepts either `crn` or `caseReferenceNumber` query parameters in the format "NN-NNNNNN".
 * If a valid case reference number is found, it sets `caseSelected` and `caseReferenceNumber` in the session.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const getCaseReferenceNumberFromQueryString = (req, res, next) => {
    const crnRegex = /^[0-9]{2}-[0-9]{6}$/;
    const { crn, caseReferenceNumber } = req.query;
    let validCrn;

    if (crn && crnRegex.test(crn)) {
        validCrn = crn;
    } else if (caseReferenceNumber && crnRegex.test(caseReferenceNumber)) {
        validCrn = caseReferenceNumber;
    }

    if (validCrn) {
        if (req.session) {
            req.session.caseSelected = true;
            req.session.caseReferenceNumber = validCrn;
        }
    }

    next();
};

export default getCaseReferenceNumberFromQueryString;
