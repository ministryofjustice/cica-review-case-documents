'use strict';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {nanoid} from 'nanoid';
import session from 'express-session';
import createRedisStore from './session/redis-store.js';

import createCsrf from './middleware/csrf/index.js';
import getCaseReferenceNumberFromQueryString from './middleware/getCaseReferenceNumberFromQueryString/index.js';
import {caseSelected} from './middleware/caseSelected/index.js';
import defaultCreateLogger from './middleware/logger/index.js';
import ensureEnvVarsAreValid from './middleware/ensureEnvVarsAreValid/index.js';
import createTemplateEngineService from './templateEngine/index.js';
import indexRouter from './index/routes.js';
import searchRouter from './search/routes.js';
import { checkOpenSearchHealth } from './db/healthcheck.js';

import authRouter from './auth/auth.js';
import apiRouter from './api/app.js';



let sessionStore;

function createApp({createLogger = defaultCreateLogger} = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();
    
    app.use(createLogger());
    app.use(ensureEnvVarsAreValid);
    // MUST be before session middleware
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
        sessionStore = createRedisStore(session);
    }

    const sessionMiddleware = session({
        name: process.env.APP_COOKIE_NAME,
        secret: process.env.APP_COOKIE_SECRET,
        resave: false,
        saveUninitialized: false, // recommended for auth
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'lax'
        }
    });
    app.use(sessionMiddleware);

    app.use(cookieParser());
    const {doubleCsrfProtection, generateCsrfToken} = createCsrf();

    app.use(createLogger());
    
    app.use((req, res, next) => {
        res.locals.cspNonce = nanoid();
        next();
    });

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'strict-dynamic'",
                        // https://content-security-policy.com/unsafe-inline/
                        // "it is only ok to use unsafe-inline when it is combined with the strict-dynamic csp directive."
                        "'unsafe-inline'",
                        (req, res) => `'nonce-${res.locals.cspNonce}'`,
                        'https:'
                    ],
                    imgSrc: ["'self'", 'data:', '*.google-analytics.com', 'www.googletagmanager.com'],
                    objectSrc: ["'none'"],
                    connectSrc: ["'self'", '*.google-analytics.com'],
                    // https://www.therobinlord.com/ga4-is-being-blocked-by-content-security-policy/
                    formAction: ["'self'", '*.account.gov.uk']
                }
            },
            xFrameOptions: {action: 'deny'},
            strictTransportSecurity: {
                maxAge: 60 * 60 * 24 * 365,
                includeSubDomains: true
            }
        })
    );
    
    const templateEngineService = createTemplateEngineService(app);
    templateEngineService.init();
    
    app.use(express.static(path.join(__dirname, 'public')));

    app.use(
        '/assets',
        express.static(path.join(__dirname, '/node_modules/govuk-frontend/dist/govuk/assets'))
    );

    // Add body parser for urlencoded form data
    app.use(express.urlencoded({ extended: false }));

    app.use((req, res, next) => {
        res.locals.csrfToken = generateCsrfToken(req, res);
        next();
    });

    app.use(doubleCsrfProtection);

    app.use('/auth', authRouter);
    app.use('/api', apiRouter);

    // Protect routes below this line
    app.use((req, res, next) => {
        req.log.info({
            sessionID: req.sessionID,
            session: req.session,
            loggedIn: req.session?.loggedIn,
            cookies: req.cookies
        }, 'Session check');
        const isApiRequest = req.path.startsWith('/api');
        if (!req.session.loggedIn && req.path !== '/auth/login') {
            if (isApiRequest) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
        }
        next();
    });

    app.use('/', indexRouter);
    app.use('/search', getCaseReferenceNumberFromQueryString, caseSelected, searchRouter);

    // Page not found handler
    app.use((req, res) => {
        res.status(404).render('404.njk');
    });

    return { app, sessionMiddleware };
}

export default createApp;

const { app } = createApp();


// App startup sequence: env vars validated inside createApp middleware chain.
// Only start listening if OpenSearch cluster is healthy.
const PORT = process.env.PORT || 5000;
const OPENSEARCH_URL = process.env.APP_DATABASE_URL || 'http://localhost:9200';

checkOpenSearchHealth(OPENSEARCH_URL).then(isHealthy => {
    if (isHealthy) {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } else {
        console.error('OpenSearch is unhealthy. Exiting.');
        process.exit(1);
    }
});


