import assert from 'node:assert';
import { test } from 'node:test';
import getJwtCookieOptions from './jwtCookieOptions.js';

test('should set httpOnly to true', () => {
    assert.strictEqual(getJwtCookieOptions().httpOnly, true);
});

test('should set sameSite to lax', () => {
    assert.strictEqual(getJwtCookieOptions().sameSite, 'lax');
});

test('should set secure to true in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    assert.strictEqual(getJwtCookieOptions().secure, true);
    process.env.NODE_ENV = originalNodeEnv;
});

test('should set secure to false in non-production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    assert.strictEqual(getJwtCookieOptions().secure, false);
    process.env.NODE_ENV = originalNodeEnv;
});

test('should use JWT_COOKIE_MAX_AGE from env if set', () => {
    const originalMaxAge = process.env.JWT_COOKIE_MAX_AGE;
    process.env.JWT_COOKIE_MAX_AGE = '123456';
    assert.strictEqual(getJwtCookieOptions().maxAge, 123456);
    process.env.JWT_COOKIE_MAX_AGE = originalMaxAge;
});

test('should fallback to 1 hour if JWT_COOKIE_MAX_AGE is not set', () => {
    const originalMaxAge = process.env.JWT_COOKIE_MAX_AGE;
    delete process.env.JWT_COOKIE_MAX_AGE;
    assert.strictEqual(getJwtCookieOptions().maxAge, 60 * 60 * 1000);
    process.env.JWT_COOKIE_MAX_AGE = originalMaxAge;
});
