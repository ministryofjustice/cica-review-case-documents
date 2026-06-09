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
    if (!res.locals.featureFlags?.debug) {
        return next();
    }
    const requestStartTime = Date.now();

    const buildResolvedRoute = () => {
        const baseUrl = req.baseUrl || '';
        const routePath = req.route?.path;

        if (!routePath) {
            return null;
        }

        if (routePath === '/') {
            return baseUrl || '/';
        }

        return `${baseUrl}${routePath}` || routePath;
    };

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
            route: buildResolvedRoute(),
            query: req.query,
            url: req.originalUrl,
            startedAt: new Date(requestStartTime).toISOString(),
            responseStatus: null,
            elapsedMs: null,
            queryDsl: null
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
        }
    };

    res.locals.finalizeDebugInfo = ({ responseStatus } = {}) => {
        if (!res.locals.debugInfo) {
            return;
        }

        const elapsedMs = Date.now() - requestStartTime;
        res.locals.debugInfo.request.route =
            buildResolvedRoute() || res.locals.debugInfo.request.route;
        res.locals.debugInfo.request.responseStatus =
            responseStatus ?? res.statusCode ?? res.locals.debugInfo.request.responseStatus;
        res.locals.debugInfo.request.elapsedMs = elapsedMs;
    };

    next();
}

/**
 * Returns true when request-scoped debug context is available.
 *
 * @param {import('express').Response} res - Express response object.
 * @returns {boolean} Whether debug mode is active and debugInfo is initialized.
 */
export function hasDebugContext(res) {
    return Boolean(res?.locals?.featureFlags?.debug && res?.locals?.debugInfo);
}

/**
 * Executes a callback only when request-scoped debug context is available.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {(debugInfo: object) => void} updater - Callback that mutates debugInfo.
 * @returns {void}
 */
export function ifDebugContext(res, updater) {
    if (!hasDebugContext(res) || typeof updater !== 'function') {
        return;
    }

    updater(res.locals.debugInfo);
}

/**
 * Finalizes request-scoped debug information with the outbound response status.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {number} statusCode - HTTP status code returned to the client.
 * @returns {void}
 */
export function finalizeDebugInfo(res, statusCode) {
    if (typeof res.locals?.finalizeDebugInfo === 'function') {
        res.locals.finalizeDebugInfo({ responseStatus: statusCode });
    }
}
