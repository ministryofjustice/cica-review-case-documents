#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

function run(command, args, options = {}) {
    execFileSync(command, args, {
        stdio: 'inherit',
        ...options
    });
}

function getStagedFiles() {
    const output = execFileSync(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
        {
            encoding: 'utf8'
        }
    );

    return output ? output.split('\0').filter(Boolean) : [];
}

function getPathsWithUnstagedChanges(paths) {
    if (paths.length === 0) {
        return [];
    }

    const output = execFileSync('git', ['diff', '--name-only', '-z', '--', ...paths], {
        encoding: 'utf8'
    });

    return output ? output.split('\0').filter(Boolean) : [];
}

const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
    process.exit(0);
}

const pathsWithUnstagedChanges = getPathsWithUnstagedChanges(stagedFiles);

if (pathsWithUnstagedChanges.length > 0) {
    console.error('Pre-commit aborted: staged files contain unstaged changes.');
    console.error('Please commit fully staged files only, then retry.');
    console.error('Files:');

    for (const file of pathsWithUnstagedChanges) {
        console.error(`  - ${file}`);
    }

    process.exit(1);
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
