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
 * Determine whether staged changes affect any SCSS path, including
 * add/modify/delete/copy/rename operations.
 * @returns {boolean}
 */
function hasStagedScssChanges() {
    const output = execFileSync(
        'git',
        ['diff', '--cached', '--name-status', '-z', '--diff-filter=ACMRD'],
        {
            encoding: 'utf8'
        }
    );

    if (!output) {
        return false;
    }

    const fields = output.split('\0').filter(Boolean);

    for (let i = 0; i < fields.length; ) {
        const status = fields[i++] || '';
        const code = status[0];

        if (code === 'R' || code === 'C') {
            const oldPath = fields[i++] || '';
            const newPath = fields[i++] || '';

            if (oldPath.endsWith('.scss') || newPath.endsWith('.scss')) {
                return true;
            }

            continue;
        }

        const path = fields[i++] || '';

        if (path.endsWith('.scss')) {
            return true;
        }
    }

    return false;
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

/**
 * Get all tracked SCSS file paths.
 * @returns {string[]}
 */
function getTrackedScssFiles() {
    const output = execFileSync('git', ['ls-files', '-z', '--', '*.scss'], {
        encoding: 'utf8'
    });

    return output ? output.split('\0').filter(Boolean) : [];
}

/**
 * Get untracked SCSS file paths (excluding ignored files).
 * @returns {string[]}
 */
function getUntrackedScssFiles() {
    const output = execFileSync(
        'git',
        ['ls-files', '--others', '--exclude-standard', '-z', '--', '*.scss'],
        {
            encoding: 'utf8'
        }
    );

    return output ? output.split('\0').filter(Boolean) : [];
}

const stagedFiles = getStagedFiles();
const hasScssChanges = hasStagedScssChanges();

if (stagedFiles.length === 0 && !hasScssChanges) {
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

const biomeFiles = stagedFiles.filter((file) => {
    if (!/\.(js|json)$/.test(file)) {
        return false;
    }

    // Keep npm-generated lockfile formatting stable.
    return !/(^|\/)package-lock\.json$/.test(file);
});
if (biomeFiles.length > 0) {
    // Prefix paths with `./` so Biome never interprets them as CLI options.
    const biomePaths = biomeFiles.map((f) => `./${f}`);
    run('biome', ['check', '--write', ...biomePaths]);
}

if (hasScssChanges) {
    const trackedScssFiles = getTrackedScssFiles();
    const scssPathsWithUnstagedChanges = getPathsWithUnstagedChanges(trackedScssFiles);
    const untrackedScssFiles = getUntrackedScssFiles();

    if (scssPathsWithUnstagedChanges.length > 0) {
        console.error('Pre-commit aborted: tracked SCSS files contain unstaged changes.');
        console.error('Sass output must be generated from a fully staged SCSS working tree.');
        console.error('Files:');

        for (const file of scssPathsWithUnstagedChanges) {
            console.error(`  - ${file}`);
        }

        process.exit(1);
    }

    if (untrackedScssFiles.length > 0) {
        console.error('Pre-commit aborted: untracked SCSS files are present.');
        console.error('Sass output must be generated from a deterministic SCSS working tree.');
        console.error('Files:');

        for (const file of untrackedScssFiles) {
            console.error(`  - ${file}`);
        }

        process.exit(1);
    }

    // call the Sass binary directly to avoid nested `npm run` startup overhead in hooks.
    run('sass', [
        '--quiet-deps',
        '--load-path=.',
        '--style=compressed',
        '--no-source-map',
        'src/sass/all.scss',
        'public/stylesheets/all.css'
    ]);
}

// Use `--` so path-like arguments are never parsed as git options.
if (stagedFiles.length > 0) {
    run('git', ['add', '--', ...stagedFiles]);
}

// Ensure generated stylesheet is included when Sass sources changed.
if (hasScssChanges) {
    run('git', ['add', '--', 'public/stylesheets/all.css']);
}
