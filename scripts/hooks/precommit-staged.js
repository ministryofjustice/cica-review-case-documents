#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

/**
 * Run a command and inherit stdio.
 * @param {string} command Executable to run.
 * @param {string[]} args Arguments to pass to the executable.
 * @param {import('node:child_process').ExecFileSyncOptions} [options] Optional exec settings.
 */
function run(command, args, options = {}) {
    execFileSync(command, args, {
        stdio: 'inherit',
        ...options
    });
}

/**
 * Get staged file paths for added/copied/modified/renamed files.
 * @returns {string[]}
 */
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

/**
 * Get paths that currently have unstaged working tree changes.
 * @param {string[]} paths Paths to check.
 * @returns {string[]}
 */
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
    run('npx', ['--no-install', 'biome', 'check', '--write', ...biomeFiles]);
}

if (hasScssChanges) {
    run('npm', ['run', 'sass']);
}

// Use `--` so path-like arguments are never parsed as git options.
run('git', ['add', '--', ...stagedFiles]);

// Ensure generated stylesheet is included when Sass sources changed.
if (hasScssChanges) {
    run('git', ['add', '--', 'public/stylesheets/all.css']);
}
