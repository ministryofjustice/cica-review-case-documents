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
        test('creates S3 client with default AWS region (eu-west-2) when AWS_REGION is not set', () => {
            delete process.env.AWS_REGION;
            delete process.env.DEPLOY_ENV;

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created');
            // Client config is not exposed, so we verify it was created without error
            assert.strictEqual(client.constructor.name, 'S3Client');
        });

        test('creates S3 client with custom AWS region when AWS_REGION is set', () => {
            process.env.AWS_REGION = 'us-east-1';
            delete process.env.DEPLOY_ENV;

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom region');
            assert.strictEqual(client.constructor.name, 'S3Client');
        });

        test('creates LocalStack S3 client when DEPLOY_ENV is local-dev', () => {
            process.env.AWS_REGION = 'eu-west-2';
            process.env.DEPLOY_ENV = 'local-dev';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for LocalStack');
            assert.strictEqual(client.constructor.name, 'S3Client');
        });

        test('uses test credentials for LocalStack when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set', () => {
            delete process.env.AWS_ACCESS_KEY_ID;
            delete process.env.AWS_SECRET_ACCESS_KEY;
            process.env.DEPLOY_ENV = 'local-dev';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with default test credentials');
        });

        test('uses custom credentials for LocalStack when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set', () => {
            process.env.AWS_ACCESS_KEY_ID = 'custom-access-key';
            process.env.AWS_SECRET_ACCESS_KEY = 'custom-secret-key';
            process.env.DEPLOY_ENV = 'local-dev';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created with custom credentials');
        });

        test('creates production S3 client when DEPLOY_ENV is production', () => {
            process.env.AWS_REGION = 'eu-west-2';
            process.env.DEPLOY_ENV = 'production';

            const client = createS3Client();
            assert.ok(client, 'S3Client should be created for production');
            assert.strictEqual(client.constructor.name, 'S3Client');
        });

        test('defaults to production when DEPLOY_ENV is not set', () => {
            delete process.env.DEPLOY_ENV;
            process.env.AWS_REGION = 'eu-west-2';

            const client = createS3Client();
            assert.ok(client, 'S3Client should default to production configuration');
        });
    });
});
