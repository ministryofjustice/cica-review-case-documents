import express from 'express';
import { nanoid } from 'nanoid';
import generalRateLimiter from '../middleware/rateLimiter/index.js';
import { signOutUser } from './auth-service.js';
import {
    entraCallbackRateLimiter,
    entraLoginRateLimiter
} from './rateLimiters/entraRateLimiter.js';
import {
    buildEntraAuthorizeUrl,
    decodeAndValidateEntraIdToken,
    exchangeEntraAuthorizationCode,
    getUsernameFromEntraClaims,
    isEntraConfigured,
    isEntraInteractiveFallbackEnabled
} from './utils/entra-auth/index.js';

const router = express.Router();
const ENTRA_INTERACTION_ERRORS = new Set([
    'interaction_required',
    'login_required',
    'consent_required'
]);
const ENTRA_AUTH_TRANSACTION_MAX_AGE_MS =
    Number(process.env.ENTRA_AUTH_TRANSACTION_MAX_AGE_MS) || 10 * 60 * 1000;

/**
 * Extracts an AADSTS error code from an Entra error description string.
 *
 * @param {string | undefined} description - Optional Entra error description text.
 * @returns {string | undefined} Matched AADSTS code when present.
 */
function getEntraErrorCode(description) {
    const match = String(description || '').match(/AADSTS\d+/);
    return match ? match[0] : undefined;
}

/**
 * Creates an auth login handler that starts the Entra authorization flow.
 *
 * @returns {import('express').RequestHandler} Express handler for `/auth/login`.
 */
export const createLoginHandler = () => (req, res, next) => {
    if (!isEntraConfigured()) {
        return res.status(400).send('Entra authentication is not configured');
    }

    try {
        const interactiveRequested =
            isEntraInteractiveFallbackEnabled() && req.query?.interactive === '1';
        const state = nanoid();
        const nonce = nanoid();
        req.session.entraAuth = {
            state,
            nonce,
            createdAt: Date.now(),
            mode: interactiveRequested ? 'interactive' : 'silent'
        };

        const authorizeOptions = interactiveRequested ? {} : { prompt: 'none' };
        return res.redirect(buildEntraAuthorizeUrl(req, state, nonce, authorizeOptions));
    } catch (error) {
        return next(error);
    }
};

router.get('/login', entraLoginRateLimiter, createLoginHandler());

router.get('/callback', entraCallbackRateLimiter, async (req, res, next) => {
    try {
        if (!isEntraConfigured()) {
            return res.status(400).send('Entra authentication is not configured');
        }

        if (req.query.error) {
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
                return res.redirect('/auth/login?interactive=1');
            }

            req.log?.warn(
                {
                    error: entraError,
                    entraErrorCode,
                    errorUri: entraErrorUri
                },
                'Entra authorization failed'
            );
            return res.status(401).send('Authentication failed');
        }

        const { code, state } = req.query;
        const pendingAuth = req.session?.entraAuth;
        const hasNonce =
            typeof pendingAuth?.nonce === 'string' && pendingAuth.nonce.trim().length > 0;
        const createdAtMs = Number(pendingAuth?.createdAt);
        const isStaleAuthTransaction =
            !Number.isFinite(createdAtMs) ||
            Date.now() - createdAtMs > ENTRA_AUTH_TRANSACTION_MAX_AGE_MS;

        if (
            !code ||
            !state ||
            !pendingAuth?.state ||
            state !== pendingAuth.state ||
            !hasNonce ||
            isStaleAuthTransaction
        ) {
            delete req.session.entraAuth;
            req.log?.warn(
                {
                    hasState: Boolean(state),
                    hasNonce,
                    isStaleAuthTransaction
                },
                'Invalid Entra callback state'
            );
            return res.status(401).send('Invalid authentication state');
        }

        const tokenResponse = await exchangeEntraAuthorizationCode(req, String(code));
        const claims = await decodeAndValidateEntraIdToken(
            tokenResponse.id_token,
            pendingAuth.nonce
        );

        req.session.username = getUsernameFromEntraClaims(claims);
        req.session.loggedIn = true;
        req.session.entraUser = {
            oid: claims.oid,
            tid: claims.tid,
            name: claims.name
        };

        req.log?.info(
            {
                authMethod: 'entra',
                userId: claims.oid || claims.sub,
                tenantId: claims.tid
            },
            'User authenticated'
        );

        delete req.session.entraAuth;

        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
        return res.redirect(redirectUrl);
    } catch (err) {
        req.log?.error({ err }, 'Entra callback handling failed');
        return next(err);
    }
});

router.get('/sign-out', (req, res, next) => {
    try {
        signOutUser(req, res);
    } catch (err) {
        next(err);
    }
});

export default router;
