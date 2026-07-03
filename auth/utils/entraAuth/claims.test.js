import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getUsernameFromEntraClaims } from './claims.js';

describe('entra-auth claims utilities', () => {
    it('extracts preferred username with fallback order', () => {
        assert.equal(
            getUsernameFromEntraClaims({ preferred_username: 'preferred@example.com' }),
            'preferred@example.com'
        );
        assert.equal(
            getUsernameFromEntraClaims({ email: 'email@example.com' }),
            'email@example.com'
        );
        assert.equal(getUsernameFromEntraClaims({ upn: 'upn@example.com' }), 'upn@example.com');
        assert.equal(getUsernameFromEntraClaims({ sub: 'sub-1' }), 'sub-1');
        assert.equal(getUsernameFromEntraClaims({}), 'entra-user');
    });
});
