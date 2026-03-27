import safeErrorForLog from '../../middleware/logger/utils/safeErrorForLog/index.js';
import {
    getEntraErrorCode,
    getSessionValuesToPreserve,
    getSingleNonEmptyQueryParam,
    regenerateSession
} from '../auth-flow-helpers.js';
import { getUsernameFromEntraClaims } from '../utils/entra-auth/claims.js';
import {
    isEntraConfigured,
    isEntraInteractiveFallbackEnabled
} from '../utils/entra-auth/config.js';
import {
    decodeAndValidateEntraIdToken,
    exchangeEntraAuthorizationCode
} from '../utils/entra-auth/token.js';

const ENTRA_INTERACTION_ERRORS = new Set([
    'interaction_required',
    'login_required',
    'consent_required'
]);
const ENTRA_AUTH_TRANSACTION_MAX_AGE_MS =
    Number(process.env.ENTRA_AUTH_TRANSACTION_MAX_AGE_MS) || 10 * 60 * 1000;

/**
 * Clears the pending Entra auth transaction data from the session when present.
 *
 * @param {import('express').Request} req - Express request carrying optional session state.
 */
function clearPendingEntraAuth(req) {
    if (req.session) {
        delete req.session.entraAuth;
    }
}

/**
 * Handles callback errors returned by Entra and writes the HTTP response.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {boolean} True when an Entra error was handled and response was sent.
 */
function handleEntraCallbackError(req, res) {
    if (!req.query.error) {
        return false;
    }

    const pendingAuth = req.session?.entraAuth;
    const entraError = String(req.query.error);
    const entraErrorCode = getEntraErrorCode(req.query.error_description);
    const entraErrorUri = req.query.error_uri;

    if (
        pendingAuth?.mode === 'silent' &&
        isEntraInteractiveFallbackEnabled() &&
        ENTRA_INTERACTION_ERRORS.has(entraError)
    ) {
        req.log?.info(
            {
                error: entraError,
                entraErrorCode,
                errorUri: entraErrorUri
            },
            'Entra silent sign-in requires interaction; retrying with interactive login'
        );
        res.redirect('/auth/login?interactive=1');
        return true;
    }

    req.log?.warn(
        {
            error: entraError,
            entraErrorCode,
            errorUri: entraErrorUri
        },
        'Entra authorization failed'
    );
    clearPendingEntraAuth(req);
    res.status(401).send('Authentication failed');
    return true;
}

/**
 * Reads and validates auth transaction values from callback query/session.
 *
 * @param {import('express').Request} req - Express request object.
 * @returns {{ code: string | undefined, pendingAuth: any, hasNonce: boolean, isStaleAuthTransaction: boolean, isInvalid: boolean, state: string | undefined }}
 */
function validateAuthTransaction(req) {
    const code = getSingleNonEmptyQueryParam(req.query?.code);
    const state = getSingleNonEmptyQueryParam(req.query?.state);
    const pendingAuth = req.session?.entraAuth;
    const hasNonce = typeof pendingAuth?.nonce === 'string' && pendingAuth.nonce.trim().length > 0;
    const createdAtMs = Number(pendingAuth?.createdAt);
    const isStaleAuthTransaction =
        !Number.isFinite(createdAtMs) ||
        Date.now() - createdAtMs > ENTRA_AUTH_TRANSACTION_MAX_AGE_MS;
    const isInvalid =
        !code ||
        !state ||
        !pendingAuth?.state ||
        state !== pendingAuth.state ||
        !hasNonce ||
        isStaleAuthTransaction;

    return {
        code,
        state,
        pendingAuth,
        hasNonce,
        isStaleAuthTransaction,
        isInvalid
    };
}

/**
 * Writes invalid auth transaction response and clears pending auth state.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {{ state: string | undefined, hasNonce: boolean, isStaleAuthTransaction: boolean }} details - Validation details for logging.
 */
function respondInvalidAuthTransaction(req, res, { state, hasNonce, isStaleAuthTransaction }) {
    clearPendingEntraAuth(req);
    req.log?.warn(
        {
            hasState: Boolean(state),
            hasNonce,
            isStaleAuthTransaction
        },
        'Invalid Entra callback state'
    );
    res.status(401).send('Invalid authentication state');
}

/**
 * Regenerates session and stores authenticated user details.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {{ oid?: string, tid?: string, name?: string }} claims - Verified Entra id token claims.
 * @returns {Promise<void>}
 */
async function establishAuthenticatedSession(req, claims) {
    const preservedSessionValues = getSessionValuesToPreserve(req.session);
    await regenerateSession(req);
    Object.assign(req.session, preservedSessionValues);

    req.session.username = getUsernameFromEntraClaims(claims);
    req.session.loggedIn = true;
    req.session.entraUser = {
        oid: claims.oid,
        tid: claims.tid,
        name: claims.name
    };
}

/**
 * Computes and clears post-auth redirect destination from session.
 *
 * @param {import('express').Request} req - Express request object.
 * @returns {string} Redirect URL after successful sign-in.
 */
function getPostAuthRedirectUrl(req) {
    const returnTo = req.session?.returnTo;
    const isSafeRelativeUrl =
        typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//');
    const redirectUrl = isSafeRelativeUrl ? returnTo : '/';

    if (req.session) {
        delete req.session.returnTo;
    }

    return redirectUrl;
}

/**
 * Creates an auth callback handler that completes Entra sign-in.
 *
 * @returns {import('express').RequestHandler} Express handler for `/auth/callback`.
 */
export const createCallbackHandler = () => async (req, res, next) => {
    try {
        if (!isEntraConfigured()) {
            return res.status(400).send('Entra authentication is not configured');
        }

        if (handleEntraCallbackError(req, res)) {
            return;
        }

        const { code, state, pendingAuth, hasNonce, isStaleAuthTransaction, isInvalid } =
            validateAuthTransaction(req);

        if (isInvalid) {
            respondInvalidAuthTransaction(req, res, {
                state,
                hasNonce,
                isStaleAuthTransaction
            });
            return;
        }

        const tokenResponse = await exchangeEntraAuthorizationCode(req, String(code));
        const claims = await decodeAndValidateEntraIdToken(
            tokenResponse.id_token,
            pendingAuth.nonce
        );
        await establishAuthenticatedSession(req, claims);

        req.log?.info(
            {
                authMethod: 'entra',
                userId: claims.oid || claims.sub,
                tenantId: claims.tid
            },
            'User authenticated'
        );

        clearPendingEntraAuth(req);
        const redirectUrl = getPostAuthRedirectUrl(req);
        return res.redirect(redirectUrl);
    } catch (err) {
        req.log?.error(safeErrorForLog(err), 'Entra callback handling failed');
        return next(err);
    }
};
