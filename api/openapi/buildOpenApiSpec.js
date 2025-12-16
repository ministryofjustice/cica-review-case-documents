import fs from 'node:fs/promises';
import path from 'node:path';
import prepareApiSpec from './utils/prepareApiSpec/index.js';

(async () => {
    try {
        const builtApiSpec = await prepareApiSpec('./api/openapi/openapi.json');
        const outputPath = path.join(process.cwd(), '/api/openapi/openapi-dist.json');
        await fs.writeFile(outputPath, JSON.stringify(builtApiSpec, null, 4), 'utf-8');
        console.log(`OpenAPI spec written to ${outputPath}`);
    } catch (err) {
        console.error('Error building OpenAPI spec:', err);
        process.exit(1);
    }
})();
