import assert from 'node:assert';
import test from 'node:test';
import { getAuthConfig } from './index.js';

const OLD_ENV = { ...process.env.test };

test('should return secret and usernames from environment variables', () => {
    process.env.AUTH_SECRET_PASSWORD = 'mySecret';
    process.env.AUTH_USERNAMES = 'user1,user2';
    const config = getAuthConfig();
    assert.deepStrictEqual(config, {
        secret: 'mySecret',
        usernames: ['user1', 'user2']
    });
});

test('should trim and lowercase usernames', () => {
    process.env.AUTH_SECRET_PASSWORD = 'anotherSecret';
    process.env.AUTH_USERNAMES = ' UserA , USERB ';
    const config = getAuthConfig();
    assert.deepStrictEqual(config, {
        secret: 'anotherSecret',
        usernames: ['usera', 'userb']
    });
});

test('should filter out empty usernames', () => {
    process.env.AUTH_SECRET_PASSWORD = 'secret';
    process.env.AUTH_USERNAMES = 'user1,,user2, ';
    const config = getAuthConfig();
    assert.deepStrictEqual(config, {
        secret: 'secret',
        usernames: ['user1', 'user2']
    });
});

test('should return empty usernames array if AUTH_USERNAMES is not set', () => {
    process.env.AUTH_SECRET_PASSWORD = 'secret';
    delete process.env.AUTH_USERNAMES;
    const config = getAuthConfig();
    assert.deepStrictEqual(config, {
        secret: 'secret',
        usernames: []
    });
});

test('should return undefined secret if AUTH_SECRET_PASSWORD is not set', () => {
    delete process.env.AUTH_SECRET_PASSWORD;
    process.env.AUTH_USERNAMES = 'user1';
    const config = getAuthConfig();
    assert.deepStrictEqual(config, {
        secret: undefined,
        usernames: ['user1']
    });
});

// Restore environment after all tests
test.after(() => {
    process.env = { ...OLD_ENV };
});
