/**
 * Extracts and validates a case reference number (CRN) from the request query string.
 *
 * If a valid CRN (matching the format `NN-NNNNNN`, e.g. `12-345678`) is found in either
 * the `crn` or `caseReferenceNumber` query parameter, it is stored in the session under
 * `req.session.caseReferenceNumber` and `req.session.caseSelected` is set to `true`.
 *
 * @function getCaseReferenceNumberFromQueryString
 * @param {import('express').Request} req - The Express request object. Should contain a `query` object with potential CRN values and a `session` object for storing session data.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express middleware next function, called to pass control to the next middleware.
 *
 * @returns {void} This middleware does not return a value. It calls `next()` to continue request processing.
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
