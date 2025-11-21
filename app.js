import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import apiApp from './api/app.js';
import createTemplateEngineService from './templateEngine/index.js';
import indexRouter from './index/routes.js';
import { caseSelected } from './middleware/caseSelected/index.js';
import createCsrf from './middleware/csrf/index.js';
import ensureEnvVarsAreValid from './middleware/ensureEnvVarsAreValid/index.js';
import getCaseReferenceNumberFromQueryString from './middleware/getCaseReferenceNumberFromQueryString/index.js';
import defaultCreateLogger from './middleware/logger/index.js';
import searchRouter from './search/routes.js';
import isAuthenticated from './middleware/isAuthenticated/index.js';
import authRouter from './auth/routes.js';

function createApp({ createLogger = defaultCreateLogger } = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();

    const { doubleCsrfProtection, generateCsrfToken } = createCsrf();

    // https://expressjs.com/en/api.html#express.json
    app.use(express.json());
    // https://expressjs.com/en/api.html#express.urlencoded
    app.use(express.urlencoded({ extended: true }));
    app.use(
        cookieParser(null, {
            httpOnly: true
        })
    );

    // Create the logger instance
    const loggerMiddleware = createLogger();
    // Use the middleware for request logging
    app.use(loggerMiddleware);

    app.use((req, res, next) => {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'Surrogate-Control': 'no-store'
        });
        next();
    });

    app.use(ensureEnvVarsAreValid);

    app.use(
        session({
            name: process.env.APP_COOKIE_NAME,
            secret: process.env.APP_COOKIE_SECRET,
            resave: false,
            saveUninitialized: true,
            cookie: {
                secure: process.env.NODE_ENV === 'production'
            }
        })
    );

    app.use((req, res, next) => {
        res.locals.cspNonce = nanoid();
        res.set('Application-Version', process.env.npm_package_version);
        next();
    });

    app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: true,
                xXssProtection: false,
                directives: {
                    baseUri: ["'self'"],
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
                    imgSrc: [
                        "'self'",
                        'data:',
                        '*.google-analytics.com',
                        'www.googletagmanager.com'
                    ],
                    objectSrc: ["'none'"],
                    connectSrc: ["'self'", '*.google-analytics.com'],
                    // https://www.therobinlord.com/ga4-is-being-blocked-by-content-security-policy/
                    formAction: ["'self'", '*.account.gov.uk']
                }
            },
            xFrameOptions: { action: 'deny' },
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

    app.use(doubleCsrfProtection);
    app.use((req, res, next) => {
        res.locals.csrfToken = generateCsrfToken(req, res);
        next();
    });

    app.use('/auth', authRouter);

    app.use('/api', isAuthenticated, apiApp);
    app.use('/', isAuthenticated, indexRouter);
    app.use(
        '/search',
        isAuthenticated,
        getCaseReferenceNumberFromQueryString,
        caseSelected,
        searchRouter
    );

    app.use((req, res) => {
        res.status(404).render('404.njk', {
            pageType: ['root']
        });
    });

    return app;
}

export default createApp;
