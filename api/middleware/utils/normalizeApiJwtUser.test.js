import assert from 'node:assert/strict';
import { test } from 'node:test';
import normalizeApiJwtUser from './normalizeApiJwtUser.js';

test('normalizes using precedence order id > userId > username', () => {
    const user = {
        id: 'id-value',
        userId: 'user-id-value',
        username: 'username-value'
    };

    const normalized = normalizeApiJwtUser(user);

    assert.equal(normalized.id, 'id-value');
});

test('treats 0 as a valid identifier (does not drop falsy numeric id)', () => {
    const user = {
        userId: 0,
        username: 'fallback-username'
    };

    const normalized = normalizeApiJwtUser(user);

    assert.equal(normalized.id, 0);
});
