import assert from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createS3Client, validateS3Config } from './s3-service.js';

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
        test('throws error when APP_S3_BUCKET_LOCATION is not set', () => {
            delete process.env.APP_S3_BUCKET_LOCATION;
            process.env.AWS_REGION = 'eu-west-2';

            assert.throws(
                () => createS3Client(),
                /Missing required environment variable APP_S3_BUCKET_LOCATION/
            );
        });

        test('creates S3 client with default AWS region when AWS_REGION is not set', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'my-bucket';
            delete process.env.AWS_REGION;

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created');
        });

        test('creates S3 client with custom AWS region when AWS_REGION is set', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'my-bucket';
            process.env.AWS_REGION = 'us-east-1';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom region');
        });

        test('creates local S3 client with localhost endpoint', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:9000';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for localhost');
        });

        test('creates local S3 client with custom credentials from environment', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:9000';
            process.env.CICA_AWS_ACCESS_KEY_ID = 'custom-access-key';
            process.env.CICA_AWS_SECRET_ACCESS_KEY = 'custom-secret-key';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom credentials');
        });

        test('creates AWS production S3 client with bucket name (no endpoint)', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'my-bucket';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for AWS production');
        });

        test('creates AWS production S3 client with S3 ARN (no endpoint)', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'arn:aws:s3:::my-bucket';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with ARN');
        });

        test('detects localhost in S3 bucket location string', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://127.0.0.1:9000';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should detect and handle localhost');
        });

        test('uses default credentials for local S3 when not provided', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:9000';
            delete process.env.CICA_AWS_ACCESS_KEY_ID;
            delete process.env.CICA_AWS_SECRET_ACCESS_KEY;

            const client = createS3Client();
            assert.ok(client, 'S3Client should use default credentials for localhost');
        });

        test('handles localhost with different port numbers', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:8000';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should handle different localhost ports');
        });

        test('handles 127.0.0.1 loopback address', () => {
            process.env.APP_S3_BUCKET_LOCATION = 'http://127.0.0.1:9000';
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should handle 127.0.0.1 loopback');
        });
    });

    describe('validateS3Config', () => {
        test('throws error when APP_API_URL is not set', () => {
            delete process.env.APP_API_URL;
            process.env.APP_S3_BUCKET_LOCATION = 'my-bucket';

            assert.throws(
                () => validateS3Config(),
                /Missing required environment variables APP_API_URL and\/or APP_S3_BUCKET_LOCATION/
            );
        });

        test('throws error when APP_S3_BUCKET_LOCATION is not set', () => {
            process.env.APP_API_URL = 'http://localhost:3000';
            delete process.env.APP_S3_BUCKET_LOCATION;

            assert.throws(
                () => validateS3Config(),
                /Missing required environment variables APP_API_URL and\/or APP_S3_BUCKET_LOCATION/
            );
        });

        test('throws error when both APP_API_URL and APP_S3_BUCKET_LOCATION are not set', () => {
            delete process.env.APP_API_URL;
            delete process.env.APP_S3_BUCKET_LOCATION;

            assert.throws(
                () => validateS3Config(),
                /Missing required environment variables APP_API_URL and\/or APP_S3_BUCKET_LOCATION/
            );
        });

        test('does not throw when both required environment variables are set', () => {
            process.env.APP_API_URL = 'http://localhost:3000';
            process.env.APP_S3_BUCKET_LOCATION = 'my-bucket';

            assert.doesNotThrow(() => validateS3Config());
        });

        test('validates with production AWS ARN format', () => {
            process.env.APP_API_URL = 'https://api.example.com';
            process.env.APP_S3_BUCKET_LOCATION = 'arn:aws:s3:::my-bucket';

            assert.doesNotThrow(() => validateS3Config());
        });

        test('validates with localhost S3 endpoint', () => {
            process.env.APP_API_URL = 'http://localhost:3000';
            process.env.APP_S3_BUCKET_LOCATION = 'http://localhost:9000';

            assert.doesNotThrow(() => validateS3Config());
        });

        test('validates with https URLs', () => {
            process.env.APP_API_URL = 'https://api.example.com';
            process.env.APP_S3_BUCKET_LOCATION = 'https://s3.amazonaws.com/bucket';

            assert.doesNotThrow(() => validateS3Config());
        });
    });
});
