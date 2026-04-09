import { nanoid } from 'nanoid';

import {
    buildEntraAuthorizeUrl,
    isEntraConfigured,
    isEntraInteractiveFallbackEnabled
} from '../utils/entra-auth/config.js';

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
