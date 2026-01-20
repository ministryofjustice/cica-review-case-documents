import { S3Client } from '@aws-sdk/client-s3';

/**
 * Creates and configures an S3 client based on environment variables.
 *
 * @returns {S3Client} Configured S3 client instance
 * @throws {Error} If required environment variables are missing
 */
export function createS3Client() {
    const S3_BUCKET_LOCATION = process.env.APP_S3_BUCKET_LOCATION;
    const AWS_REGION = process.env.AWS_REGION || 'eu-west-2';

    if (!S3_BUCKET_LOCATION) {
        throw new Error('Missing required environment variable APP_S3_BUCKET_LOCATION');
    }

    const isLocal = S3_BUCKET_LOCATION.includes('localhost');

    return new S3Client({
        region: AWS_REGION,
        ...(isLocal
            ? {
                  endpoint: S3_BUCKET_LOCATION,
                  forcePathStyle: true,
                  credentials: {
                      accessKeyId: process.env.CICA_AWS_ACCESS_KEY_ID || 'test',
                      secretAccessKey: process.env.CICA_AWS_SECRET_ACCESS_KEY || 'test'
                  }
              }
            : {
                  // In AWS, use IRSA: do not set endpoint or credentials
              })
    });
}

/**
 * Validates that required S3 environment variables are set.
 *
 * @throws {Error} If required environment variables are missing. Catches configuration issues early.
 */
export function validateS3Config() {
    const API_BASE_URL = process.env.APP_API_URL;
    const S3_BUCKET_LOCATION = process.env.APP_S3_BUCKET_LOCATION;

    if (!API_BASE_URL || !S3_BUCKET_LOCATION) {
        throw new Error(
            'Missing required environment variables APP_API_URL and/or APP_S3_BUCKET_LOCATION'
        );
    }
}
