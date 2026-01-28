import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Handles the image streaming endpoint.
 * Streams document page images directly from S3.
 *
 * @param {S3Client} s3Client - Configured S3 client
 * @param {Function} createMetadataService - Factory function to create metadata service
 * @returns {Function} Express route handler
 */
export function createImageStreamingHandler(s3Client, createMetadataService) {
    return async (req, res) => {
        try {
            // Use pre-validated parameters from middleware
            const { documentId, pageNumber, crn } = req.validatedParams;

            // Fetch metadata from API to get the S3 URI
            let pageMetadata;
            try {
                const metadataService = createMetadataService({
                    documentId,
                    pageNumber,
                    crn,
                    jwtToken: req.cookies?.jwtToken,
                    logger: req.log
                });
                pageMetadata = await metadataService.getPageMetadata();
            } catch (error) {
                req.log?.warn(
                    { error: error.message, documentId, pageNumber, crn },
                    'Failed to retrieve page metadata for image streaming'
                );
                return res.status(204).end();
            }

            if (!pageMetadata.imageUrl) {
                req.log?.warn(
                    { documentId, pageNumber, crn },
                    'S3 URI not found in metadata for image streaming'
                );
                return res.status(204).end();
            }

            // Parse S3 URI to get bucket and object key
            const s3PathParts = pageMetadata.imageUrl.replace('s3://', '').split('/');
            const bucketName = s3PathParts.shift();
            const objectKey = s3PathParts.join('/');

            try {
                const command = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey
                });

                // Get the content from S3
                const { Body, ContentType, ContentLength } = await s3Client.send(command);

                res.set('Content-Type', ContentType || 'image/png');
                if (ContentLength) {
                    res.set('Content-Length', ContentLength);
                }

                // Stream the image to the browser
                Body.pipe(res);
            } catch (err) {
                // Handle S3 errors gracefully
                const errorName = err.name || err.Code || '';
                const errorMessage = err.message || '';

                // Return 204 No Content for missing images or access issues
                // This allows the UI to handle missing images gracefully
                if (
                    errorName === 'NoSuchKey' ||
                    errorName === 'NotFound' ||
                    errorMessage.includes('does not exist')
                ) {
                    req.log?.info({ documentId, pageNumber, crn }, 'Image not found in S3');
                    return res.status(204).end();
                }

                // For other S3 errors (credentials, network, etc.), also return 204
                // to prevent cascading failures
                req.log?.warn(
                    { error: err.message, documentId, pageNumber },
                    'S3 error when streaming image'
                );
                return res.status(204).end();
            }
        } catch (err) {
            req.log?.error({ error: err.message }, 'Error in image streaming endpoint');
            res.status(500).json({
                errors: [
                    {
                        status: 500,
                        title: 'Internal Server Error',
                        detail: err.message
                    }
                ]
            });
        }
    };
}
