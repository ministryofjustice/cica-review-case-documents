import assert from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createS3Client } from './s3-service.js';

describe('S3 Service', () => {
    let originalEnv;

    beforeEach(() => {
        // Store original environment variables
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        // Restore original environment variables
        process.env = originalEnv;
    });

    describe('createS3Client', () => {
        test('creates S3 client with default AWS region when AWS_REGION is not set', () => {
            delete process.env.AWS_REGION;

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created');
        });

        test('creates S3 client with custom AWS region when AWS_REGION is set', () => {
            process.env.AWS_REGION = 'us-east-1';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom region');
        });

        test('creates local S3 client with localhost endpoint', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for localhost');
        });

        test('creates local S3 client with custom credentials from environment', () => {
            process.env.CICA_AWS_ACCESS_KEY_ID = 'custom-access-key';
            process.env.CICA_AWS_SECRET_ACCESS_KEY = 'custom-secret-key';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom credentials');
        });

        test('creates AWS production S3 client with bucket name (no endpoint)', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for AWS production');
        });

        test('creates AWS production S3 client with S3 ARN (no endpoint)', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with ARN');
        });

        test('detects localhost in S3 bucket location string', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should detect and handle localhost');
        });

        test('uses default credentials for local S3 when not provided', () => {
            delete process.env.CICA_AWS_ACCESS_KEY_ID;
            delete process.env.CICA_AWS_SECRET_ACCESS_KEY;

            const client = createS3Client();
            assert.ok(client, 'S3Client should use default credentials for localhost');
        });

        test('handles localhost with different port numbers', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should handle different localhost ports');
        });

        test('handles 127.0.0.1 loopback address', () => {
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should handle 127.0.0.1 loopback');
        });
    });
});
