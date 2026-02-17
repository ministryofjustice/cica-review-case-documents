import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPageTitle, toSentenceCaseAfterDash } from './index.js';

describe('Text Formatters', () => {
    describe('toSentenceCaseAfterDash', () => {
        it('formats text with dash correctly', () => {
            const result = toSentenceCaseAfterDash('TC19 - ADDITIONAL INFO REQUEST');
            assert.strictEqual(result, 'TC19 - Additional info request');
        });

        it('returns unchanged text without dash', () => {
            const result = toSentenceCaseAfterDash('NO DASH HERE');
            assert.strictEqual(result, 'NO DASH HERE');
        });

        it('handles empty string', () => {
            const result = toSentenceCaseAfterDash('');
            assert.strictEqual(result, '');
        });

        it('handles single word', () => {
            const result = toSentenceCaseAfterDash('SingleWord');
            assert.strictEqual(result, 'SingleWord');
        });

        it('formats multiple dashes (only first dash counts)', () => {
            const result = toSentenceCaseAfterDash('PREFIX - TEXT - MORE');
            assert.strictEqual(result, 'PREFIX - Text - more');
        });
    });

    describe('formatPageTitle', () => {
        it('formats correspondence type as page title', () => {
            const result = formatPageTitle('TC19 - ADDITIONAL INFO REQUEST');
            assert.strictEqual(result, 'TC19 - Additional info request');
        });

        it('uses default fallback when correspondence type is null', () => {
            const result = formatPageTitle(null);
            assert.strictEqual(result, 'Document image');
        });

        it('uses default fallback when correspondence type is undefined', () => {
            const result = formatPageTitle(undefined);
            assert.strictEqual(result, 'Document image');
        });

        it('uses custom fallback when provided', () => {
            const result = formatPageTitle(null, 'Custom default');
            assert.strictEqual(result, 'Custom default');
        });

        it('uses custom fallback even when correspondence type is empty', () => {
            const result = formatPageTitle('', 'Empty fallback');
            assert.strictEqual(result, 'Empty fallback');
        });
    });
});
