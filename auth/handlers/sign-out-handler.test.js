import assert from 'node:assert';
import { test } from 'node:test';

import { signOutUser } from './sign-out-handler.js';

test('signOutUser calls next with error when session destroy fails', (_, done) => {
    const destroyError = new Error('Session store unavailable');
    const req = {
        session: {
            destroy: (callback) => callback(destroyError)
        },
        log: { error: () => {} }
    };
    const res = {};

    signOutUser(req, res, (err) => {
        assert.strictEqual(err, destroyError);
        done();
    });
});
