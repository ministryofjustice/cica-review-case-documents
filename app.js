import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { nanoid } from 'nanoid';
import createApi from './api/app.js';
import rateLimitErrorHandler from './auth/rateLimiters/authRateLimitErrorHandler.js';
import authRouter from './auth/routes.js';
import indexRouter from './index/routes.js';
import { caseSelected } from './middleware/caseSelected/index.js';
import createCsrf from './middleware/csrf/index.js';
import enforceCrnInQuery from './middleware/enforceCrnInQuery/index.js';
import ensureEnvVarsAreValid from './middleware/ensureEnvVarsAreValid/index.js';
import errorHandler from './middleware/errors/globalErrorHandler.js';
import notFoundHandler from './middleware/errors/notFoundHandler.js';
import getCaseReferenceNumberFromQueryString from './middleware/getCaseReferenceNumberFromQueryString/index.js';
import isAuthenticated from './middleware/isAuthenticated/index.js';
import defaultCreateLogger from './middleware/logger/index.js';
import generalRateLimiter from './middleware/rateLimiter/index.js';
import searchRouter from './search/routes.js';
import createSearchService from './search/search-service.js';
import createTemplateEngineService from './templateEngine/index.js';

/**
 * Creates and configures an Express application with middleware for logging, security, session management,
 * CSRF protection, static assets, and routing.
 *
 * @function
 * @param {Object} [options] - Optional configuration object.
 * @param {Function} [options.createLogger=defaultCreateLogger] - Factory function to create a request logger middleware.
 * @returns {import('express').Express} The configured Express application instance.
 */
async function createApp({ createLogger = defaultCreateLogger } = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();

    // https://expressjs.com/en/api.html#express.json
    app.use(express.json());
    // https://expressjs.com/en/api.html#express.urlencoded
    app.use(express.urlencoded({ extended: true }));
    // CSRF protection is enforced after cookies are parsed
    app.use(
        cookieParser(null, {
            httpOnly: true
        })
    );

    // Use the middleware for request logging
    app.use(createLogger());
    // test

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

    app.set('trust proxy', 1); // trust first proxy (ingress)

    app.use(
        session({
            name: process.env.APP_COOKIE_NAME,
            secret: process.env.APP_COOKIE_SECRET,
            resave: false,
            saveUninitialized: true,
            cookie: {
                // Secure cookies are enabled in production by default
                // APP_ALLOW_INSECURE_COOKIE=true is only needed for local Docker/Kubernetes testing
                // (where NODE_ENV=production but HTTPS is not available)
                // Not needed for 'npm run start:dev' which runs with NODE_ENV=development
                secure:
                    process.env.NODE_ENV === 'production' &&
                    process.env.APP_ALLOW_INSECURE_COOKIE !== 'true'
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

    const { doubleCsrfProtection, generateCsrfToken } = createCsrf();
    app.use(doubleCsrfProtection);
    app.use((req, res, next) => {
        res.locals.csrfToken = generateCsrfToken(req, res);
        next();
    });

    // Apply General Rate Limiter GLOBALLY (Fixes CodeQL)
    // Note: auth login exclusion is handled within the limiter configuration
    app.use(generalRateLimiter);

    app.use('/', indexRouter);

    // Auth routes (login, etc.)
    app.use('/auth', authRouter);

    app.use('/api', await createApi());
    // Security: enforceCrnInQuery uses an explicit allowlist of redirect-eligible paths (see middleware).
    // If you add a new route that should support internal redirects, update the allowlist and its test.
    app.use(enforceCrnInQuery);
    app.use(
        '/search',
        isAuthenticated,
        generalRateLimiter,
        getCaseReferenceNumberFromQueryString,
        caseSelected,
        searchRouter({ createTemplateEngineService, createSearchService })
    );

    app.use(notFoundHandler);
    app.use(rateLimitErrorHandler(app));
    app.use(errorHandler);

    return app;
}

export default createApp;
