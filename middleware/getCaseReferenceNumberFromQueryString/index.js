const CRN_REGEX = /^\d{2}-[78]\d{5}$/;

/**
 * Middleware to extract and validate a case reference number from the query string.
 * Accepts either `crn` or `caseReferenceNumber` query parameters in the format YY-7NNNNN or YY-8NNNNN (e.g. 26-711111, 36-873423), where YY = year, 7 = Personal Injury, 8 = Bereavement, and NNNNN = 5-digit case ID.
 * If a valid case reference number is found, it sets `caseSelected` and `caseReferenceNumber` in the session.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const getCaseReferenceNumberFromQueryString = (req, res, next) => {
    const { crn, caseReferenceNumber } = req.query;
    let validCrn;

    if (crn && CRN_REGEX.test(crn)) {
        validCrn = crn;
    } else if (caseReferenceNumber && CRN_REGEX.test(caseReferenceNumber)) {
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
