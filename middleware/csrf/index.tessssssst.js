/* eslint-disable global-require */

'use strict';

import {doubleCsrf} from 'csrf-csrf';

import { describe, it, beforeEach, mock} from "node:test";
import assert from "node:assert";

// jest.mock('csrf-csrf', () => ({
//     doubleCsrf: jest.fn(() => ({
//         doubleCsrfProtection: jest.fn(),
//         generateToken: jest.fn()
//     }))
// }));

mock.method(doubleCsrf, "doubleCsrfProtection", async () => mock.fn());
mock.method(doubleCsrf, "generateToken", async () => mock.fn());

describe('csrf module', () => {
    beforeEach(() => {
        mock.reset();
    });

    it('calls doubleCsrf with correct config in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.CW_COOKIE_SECRET = 'prod-secret';

        // const {doubleCsrf} = require('csrf-csrf');

        jest.isolateModules(() => {
            require('./index');
        });

        expect(doubleCsrf).toHaveBeenCalledTimes(1);

        expect(doubleCsrf).toHaveBeenCalledWith({
            getSecret: expect.any(Function),
            getTokenFromRequest: expect.any(Function),
            cookieName: '__Host-request-config',
            cookieOptions: {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: 'Lax'
            }
        });
    });

    it('calls doubleCsrf with correct config in development', () => {
        process.env.NODE_ENV = 'development';
        process.env.CW_COOKIE_SECRET = 'dev-secret';
        const {doubleCsrf} = require('csrf-csrf');

        jest.isolateModules(() => {
            require('./index');
        });

        expect(doubleCsrf).toHaveBeenCalledTimes(1);

        expect(doubleCsrf).toHaveBeenCalledWith({
            getSecret: expect.any(Function),
            getTokenFromRequest: expect.any(Function),
            cookieName: 'request-config',
            cookieOptions: {
                path: '/',
                secure: false,
                httpOnly: true,
                sameSite: 'Lax'
            }
        });
    });
});
