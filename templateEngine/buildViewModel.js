/**
 * Merges common template locals into page-specific view model data.
 *
 * This keeps route handlers focused on page-specific fields while
 * ensuring shared context (security/debug/feature flags) stays consistent.
 *
 * Session-derived globals are also included so handlers do not have to
 * pass them manually to every render call.
 *
 * @param {import('express').Request} req - Express request containing session context.
 * @param {import('express').Response} res - Express response containing locals.
 * @param {Record<string, unknown>} [pageModel={}] - Page-specific template values.
 * @returns {Record<string, unknown>} Combined view model.
 */
export default function buildViewModel(req, res, pageModel = {}) {
    return {
        csrfToken: res.locals.csrfToken,
        cspNonce: res.locals.cspNonce,
        featureFlags: res.locals.featureFlags,
        debugInfo: res.locals.debugInfo,
        debugQueryDslConfig: res.locals.debugQueryDslConfig,
        userName: req.session?.username,
        caseSelected: req.session?.caseSelected,
        caseReferenceNumber: req.session?.caseReferenceNumber,
        ...pageModel
    };
}
