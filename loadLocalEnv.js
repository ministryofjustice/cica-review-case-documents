import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// This check now happens *before* any file I/O.
// It relies on DEPLOY_ENV being set by the startup script, not by the .env file.
if (process.env.DEPLOY_ENV === 'local-dev') {
    const envFilePath = path.resolve(process.cwd(), '.env');

    if (fs.existsSync(envFilePath)) {
        // Use require to load dotenv synchronously
        const require = createRequire(import.meta.url);
        console.log('Local development environment detected. Loading .env file.');
        require('dotenv').config({ quiet: true });
    }
}
