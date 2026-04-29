import { nanoid } from 'nanoid';
import {
    getSessionValuesToPreserve,
    getSingleNonEmptyQueryParam,
    regenerateSession
} from '../auth-flow-helpers.js';
import { buildEntraAuthorizeUrl, isEntraConfigured } from '../utils/entra-auth/config.js';

/**
 * Creates an auth login handler that starts the Entra authorization flow.
 *
 * @returns {import('express').RequestHandler} Express handler for `/auth/login`.
 */
export const createLoginHandler = () => async (req, res, next) => {
    if (!isEntraConfigured()) {
        return res.status(400).send('Entra authentication is not configured');
    }

    try {
        const interactiveRetry = req.session?.entraInteractiveRetry;
        const interactiveRequested = interactiveRetry?.enabled === true;
        const queryLoginHint = getSingleNonEmptyQueryParam(req.query?.login_hint);
        const requestedLoginHint = queryLoginHint;

        if (req.session) {
            delete req.session.entraInteractiveRetry;
        }

        const preservedSessionValues = getSessionValuesToPreserve(req.session);
        await regenerateSession(req);
        Object.assign(req.session, preservedSessionValues);

        const state = nanoid();
        const nonce = nanoid();
        req.session.entraAuth = {
            state,
            nonce,
            createdAt: Date.now(),
            mode: interactiveRequested ? 'interactive' : 'silent'
        };

        const authorizeOptions = {
            prompt: interactiveRequested ? 'select_account' : 'none'
        };

        if (requestedLoginHint) {
            authorizeOptions.loginHint = requestedLoginHint;
        }

        return res.redirect(buildEntraAuthorizeUrl(req, state, nonce, authorizeOptions));
    } catch (error) {
        return next(error);
    }
};
