import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as authService from './auth-service.js';

describe('validateLogin', () => {
    const originalEnv = { ...process.env.test };

    beforeEach(() => {
        process.env.AUTH_SECRET_PASSWORD = 'testpass';
        process.env.AUTH_USERNAMES = 'user1@example.com,user2@example.com';
    });

    it('should return errors when username and password are missing', () => {
        const result = authService.validateLogin('', '');
        assert.equal(result.error, 'Enter your username');
        assert.equal(result.usernameError, 'Enter your username');
        assert.equal(result.passwordError, 'Enter your password');
    });

    it('should return error when username is missing', () => {
        const result = authService.validateLogin('', 'testpass');
        assert.equal(result.error, 'Enter your username');
        assert.equal(result.usernameError, 'Enter your username');
        assert.equal(result.passwordError, '');
    });

    it('should return error when password is missing', () => {
        const result = authService.validateLogin('user1@example.com', '');
        assert.equal(result.error, 'Enter your password');
        assert.equal(result.usernameError, '');
        assert.equal(result.passwordError, 'Enter your password');
    });

    it('should return error for invalid username format', () => {
        const result = authService.validateLogin('invaliduser', 'testpass');
        assert.equal(result.error, 'Enter a valid username and password');
        assert.equal(result.usernameError, 'Enter a valid username and password');
        assert.equal(result.passwordError, '');
    });

    it('should return error for incorrect password', () => {
        const result = authService.validateLogin('user1@example.com', 'wrongpass');
        assert.equal(result.error, 'Enter a valid username and password');
        assert.equal(result.usernameError, 'Enter a valid username and password');
        assert.equal(result.passwordError, '');
    });

    it('should return error for username not in allowed list', () => {
        const result = authService.validateLogin('notallowed@example.com', 'testpass');
        assert.equal(result.error, 'Enter a valid username and password');
        assert.equal(result.usernameError, 'Enter a valid username and password');
        assert.equal(result.passwordError, '');
    });

    it('should return no errors for valid credentials', () => {
        const result = authService.validateLogin('user1@example.com', 'testpass');
        assert.equal(result.error, '');
        assert.equal(result.usernameError, '');
        assert.equal(result.passwordError, '');
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });
});
