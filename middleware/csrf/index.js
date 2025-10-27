'use strict';

import {doubleCsrf} from 'csrf-csrf';

const {
    doubleCsrfProtection,
    generateCsrfToken

} = doubleCsrf({
    getSecret: () => process.env.APP_COOKIE_SECRET,
    getSessionIdentifier: (req) => req.session.id,
    // eslint-disable-next-line no-underscore-dangle
    getCsrfTokenFromRequest: req => req.body._csrf,
    cookieName: process.env.NODE_ENV === 'production' ? '__Host-request-config' : 'request-config', // renamed `_csrf` cookie name.
    cookieOptions: {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'Lax'
    }
});

export {
    doubleCsrfProtection,
    generateCsrfToken
};
