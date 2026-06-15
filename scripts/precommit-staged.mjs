#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

function run(command, args, options = {}) {
    execFileSync(command, args, {
        stdio: 'inherit',
        ...options
    });
}

function getStagedFiles() {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        encoding: 'utf8'
    }).trim();

    return output ? output.split('\n').filter(Boolean) : [];
}

const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
    process.exit(0);
}

const biomeFiles = stagedFiles.filter((file) => /\.(js|json)$/.test(file));
const hasScssChanges = stagedFiles.some((file) => file.endsWith('.scss'));

if (biomeFiles.length > 0) {
    run('npx', ['biome', 'check', '--write', ...biomeFiles]);
}

if (hasScssChanges) {
    run('npm', ['run', 'sass']);
}

// Re-stage staged files that may have been modified by Biome.
run('git', ['add', ...stagedFiles]);

// Ensure generated stylesheet is included when Sass sources changed.
if (hasScssChanges) {
    run('git', ['add', 'public/stylesheets/all.css']);
}
