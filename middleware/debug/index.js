/**
 * Debug middleware that collects diagnostic information for the debug panel.
 *
 * When the debug feature flag is enabled, this middleware gathers information
 * about the current search state, feature flags, session, and environment to
 * display in a debug panel overlay.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export default function debugMiddleware(req, res, next) {
    const requestStartTime = Date.now();

    // Initialize debug info container on every request
    res.locals.debugInfo = {
        timestamp: new Date().toISOString(),
        environment: process.env.DEPLOY_ENV || 'unknown',
        session: {
            caseReferenceNumber: req.session?.caseReferenceNumber || 'not-set',
            username: req.session?.username || 'not-authenticated',
            caseSelected: req.session?.caseSelected || false
        },
        featureFlags: Object.entries(res.locals.featureFlags || {}).map(([name, value]) => ({
            name,
            value,
            source: res.locals.featureFlagProvenance?.[name] || 'default'
        })),
        request: {
            correlationId: req.id || req.headers['x-correlation-id'] || 'not-set',
            method: req.method,
            path: req.path,
            route: req.route?.path || null,
            query: req.query,
            url: req.originalUrl,
            startedAt: new Date(requestStartTime).toISOString(),
            responseStatus: null,
            elapsedMs: null
        },
        // Search-specific data (populated by route handlers)
        search: {
            lastDSL: null,
            previousDSLs: [],
            lastQuery: null,
            lastResults: null,
            executionTime: null
        },
        // Document-specific data
        document: {
            documentId: null,
            pageNumber: null,
            pageMetadata: null,
            highlightsCount: 0,
            chunksAligned: false
        },
        // API call tracking
        apiCalls: []
    };

    res.locals.recordDebugApiCall = function (call) {
        if (!res.locals.debugInfo || !Array.isArray(res.locals.debugInfo.apiCalls)) {
            return;
        }

        const statusCode = Number(call?.statusCode) || 0;
        const durationMs = Number(call?.durationMs);

        res.locals.debugInfo.apiCalls.push({
            method: call?.method || req.method,
            path: call?.path || req.path,
            statusCode,
            source: call?.source || 'internal',
            durationMs: Number.isFinite(durationMs) ? durationMs : null,
            isError: statusCode >= 400,
            errorMessage: call?.errorMessage || null,
            timestamp: new Date().toISOString()
        });
    };

    res.locals.finalizeDebugInfo = function ({ responseStatus } = {}) {
        if (!res.locals.debugInfo) {
            return;
        }

        const elapsedMs = Date.now() - requestStartTime;
        res.locals.debugInfo.request.route = req.route?.path || res.locals.debugInfo.request.route;
        res.locals.debugInfo.request.responseStatus =
            responseStatus ?? res.statusCode ?? res.locals.debugInfo.request.responseStatus;
        res.locals.debugInfo.request.elapsedMs = elapsedMs;
    };

    // Store original res.json to intercept and log API responses
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        // Track successful API responses
        res.locals.recordDebugApiCall({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - requestStartTime,
            source: 'res.json'
        });
        return originalJson(data);
    };

    next();
}
