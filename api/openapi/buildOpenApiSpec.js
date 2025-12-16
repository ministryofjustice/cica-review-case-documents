import fs from 'node:fs/promises';
import path from 'node:path';
import prepareApiSpec from './utils/prepareApiSpec/index.js';

/**
 * Builds the OpenAPI specification by dereferencing and transforming the source spec,
 * then writes the processed specification to openapi.json.
 *
 * This script is typically run as part of the build process to generate a distribution-ready
 * OpenAPI specification file with all $ref pointers resolved and custom properties transformed.
 *
 * @async
 * @function
 * @returns {Promise<void>}
 * @throws {Error} If the OpenAPI spec cannot be read, processed, or written. Exits with code 1 on error.
 */
(async () => {
    try {
        const builtApiSpec = await prepareApiSpec('./api/openapi/openapi-src.json');
        const outputPath = path.join(process.cwd(), '/api/openapi/openapi.json');
        await fs.writeFile(outputPath, JSON.stringify(builtApiSpec, null, 4), 'utf-8');
        console.log(`OpenAPI spec written to ${outputPath}`);
    } catch (err) {
        console.error('Error building OpenAPI spec:', err);
        process.exit(1);
    }
})();
