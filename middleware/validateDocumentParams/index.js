/**
 * Validates document request parameters to prevent SSRF attacks.
 * Uses middleware-style validation that can be reused across handlers.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// CRN format: YY-7NNNNN or YY-8NNNNN (e.g. 26-711111, 36-873423)
// where YY = year, 7 = Personal Injury, 8 = Bereavement, NNNNN = 5-digit case ID
const CRN_REGEX = /^\d{2}-[78]\d{5}$/;

/**
 * Validates that documentId is a valid UUID format.
 *
 * @param {string} documentId - The document ID to validate
 * @returns {Object} Object with { valid: boolean, error?: string }
 */
export function validateDocumentId(documentId) {
    if (!UUID_REGEX.test(documentId)) {
        return {
            valid: false,
            error: 'Invalid document ID format'
        };
    }
    return { valid: true };
}

/**
 * Validates that pageNumber is a positive integer.
 *
 * @param {string|number} pageNumber - The page number to validate
 * @returns {Object} Object with { valid: boolean, error?: string, value?: number }
 */
export function validatePageNumber(pageNumber) {
    // Check if it's a valid integer format (no decimal points)
    if (typeof pageNumber === 'string' && pageNumber.includes('.')) {
        return {
            valid: false,
            error: 'Invalid page number'
        };
    }

    const pageNum = parseInt(pageNumber, 10);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
        return {
            valid: false,
            error: 'Invalid page number'
        };
    }
    return { valid: true, value: pageNum };
}

/**
 * Validates that CRN (case reference number) is in a valid format.
 *
 * @param {string} crn - The case reference number to validate
 * @returns {Object} Object with { valid: boolean, error?: string }
 */
export function validateCrn(crn) {
    if (!crn || !CRN_REGEX.test(crn)) {
        return {
            valid: false,
            error: 'Invalid case reference number'
        };
    }
    return { valid: true };
}

/**
 * Express middleware to validate all document parameters.
 * Logs validation failures and passes errors to next middleware.
 *
 * @returns {Function} Express middleware function
 */
export function validateDocumentParams() {
    return (req, res, next) => {
        const { documentId, pageNumber } = req.params;
        const { crn } = req.query;

        // Validate documentId
        const docIdValidation = validateDocumentId(documentId);
        if (!docIdValidation.valid) {
            req.log?.warn({ documentId }, `Document validation: ${docIdValidation.error}`);
            const error = new Error(docIdValidation.error);
            error.status = 400;
            return next(error);
        }

        // Validate pageNumber
        const pageNumValidation = validatePageNumber(pageNumber);
        if (!pageNumValidation.valid) {
            req.log?.warn({ pageNumber }, `Page validation: ${pageNumValidation.error}`);
            const error = new Error(pageNumValidation.error);
            error.status = 400;
            return next(error);
        }

        // Validate CRN
        const crnValidation = validateCrn(crn);
        if (!crnValidation.valid) {
            req.log?.warn({ crn }, `CRN validation: ${crnValidation.error}`);
            const error = new Error(crnValidation.error);
            error.status = 400;
            return next(error);
        }

        // Attach validated values to request for use in handlers
        req.validatedParams = {
            documentId,
            pageNumber: pageNumValidation.value,
            crn
        };

        next();
    };
}
