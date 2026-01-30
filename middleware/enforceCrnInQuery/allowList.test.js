import assert from 'node:assert/strict';
import { ALLOWED_PATH_PATTERNS, ALLOWED_PATHS } from '../enforceCrnInQuery/index.js';

// --- Static allowlist test ---
const EXPECTED_ALLOWED_PATHS = ['/search'];
assert.deepStrictEqual(
    ALLOWED_PATHS.sort(),
    EXPECTED_ALLOWED_PATHS.sort(),
    'ALLOWED_PATHS does not match the expected set of redirect-eligible routes. Update the allowlist if you add new routes.'
);

// --- Pattern-based allowlist test ---
const validPaths = [
    '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1',
    '/document/abcdefab-1234-5678-abcd-abcdefabcdef/view/page/42',
    '/document/123e4567-e89b-12d3-a456-426614174000/page/1',
    '/document/55b2ea3c-3eae-54f7-b81d-292db7c84be7/page/6'
];
const invalidPaths = [
    '/document/not-a-uuid/view/page/1',
    '/document/123e4567-e89b-12d3-a456-426614174000/view/page/notanumber',
    '/document/123e4567-e89b-12d3-a456-426614174000/view/page/',
    '/document/123e4567-e89b-12d3-a456-426614174000/view/page/1/extra',
    '/document/not-a-uuid/page/1',
    '/document/123e4567-e89b-12d3-a456-426614174000/page/notanumber'
];

for (const path of validPaths) {
    assert(
        ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path)),
        `Expected pattern to match: ${path}`
    );
}
for (const path of invalidPaths) {
    assert(
        !ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path)),
        `Expected pattern NOT to match: ${path}`
    );
}
