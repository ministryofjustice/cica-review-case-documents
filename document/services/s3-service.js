import { S3Client } from '@aws-sdk/client-s3';

/**
 * Creates and returns an S3Client instance configured for either local development (using LocalStack)
 * or production (using AWS S3).
 *
 * - In local development (`DEPLOY_ENV === 'local-dev'`), connects to LocalStack at `http://localhost:4566`
 *   with test credentials.
 * - In production, uses default AWS S3 configuration (region only; credentials are managed by environment).
 *
 * @returns {S3Client} Configured AWS S3 client instance.
 */
export function createS3Client() {
    const AWS_REGION = process.env.AWS_REGION || 'eu-west-2';
    const DEPLOY_ENV = process.env.DEPLOY_ENV || 'production';

    if (DEPLOY_ENV === 'local-dev') {
        const localStackEndpoint = 'http://localhost:4566';
        // Use LocalStack endpoint for local development
        return new S3Client({
            region: AWS_REGION,
            endpoint: localStackEndpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
            }
        });
    } else {
        // Use default AWS S3 configuration (IRSA or IAM roles)
        return new S3Client({
            region: AWS_REGION
            // No endpoint or credentials needed for AWS
        });
    }
}
