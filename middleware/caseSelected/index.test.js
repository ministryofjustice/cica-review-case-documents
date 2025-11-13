import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { caseSelected } from './index.js';

describe('caseSelected', () => {
    it('Should redirect to /case if no case is selected', () => {
        const req = { session: { caseSelected: false } };
        const res = { redirect: mock.fn() };
        const next = mock.fn();

        caseSelected(req, res, next);

        assert.strictEqual(res.redirect.mock.callCount(), 1);
        assert.strictEqual(res.redirect.mock.calls[0].arguments[0], '/case');
        assert.strictEqual(next.mock.callCount(), 0);
    });

    it('Should call next() if a case is selected', () => {
        const req = { session: { caseSelected: true } };
        const res = { redirect: mock.fn() };
        const next = mock.fn();

        caseSelected(req, res, next);

        assert.strictEqual(res.redirect.mock.callCount(), 0);
        assert.strictEqual(next.mock.callCount(), 1);
    });

    it('Should redirect to /case if session object is missing', () => {
        const req = {}; // malformed session (no session key)
        const res = { redirect: mock.fn() };
        const next = mock.fn();

        caseSelected(req, res, next);

        // Should still redirect safely
        assert.strictEqual(res.redirect.mock.callCount(), 1);
        assert.strictEqual(res.redirect.mock.calls[0].arguments[0], '/case');
        assert.strictEqual(next.mock.callCount(), 0);
    });

    it('Should redirect to /case if session is not an object', () => {
        const req = { session: 'invalid' }; // invalid structure
        const res = { redirect: mock.fn() };
        const next = mock.fn();

        caseSelected(req, res, next);

        assert.strictEqual(res.redirect.mock.callCount(), 1);
        assert.strictEqual(res.redirect.mock.calls[0].arguments[0], '/case');
        assert.strictEqual(next.mock.callCount(), 0);
    });
});
