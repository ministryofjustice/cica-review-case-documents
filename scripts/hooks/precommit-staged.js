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

// --- Lint/format staged .js/.json files via Biome ---

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

// Re-stage files that Biome may have modified.
if (stagedFiles.length > 0) {
    // Use `--` so path-like arguments are never parsed as git options.
    run('git', ['add', '--', ...stagedFiles]);
}

// NOTE: Sass is intentionally NOT compiled here.
// The compiled output (public/stylesheets/all.css) is a git-ignored build
// artifact, so rebuilding it at commit time produces nothing that can be
// committed. CSS compilation is handled by `npm run sass` (run directly, and
// as the first step of the `prepush` npm script and in CI), which is also
// where broken SCSS is caught.

// NOTE: The full test suite is intentionally NOT run here.
// pre-commit is kept fast and staged-scoped so commits stay cheap; the full
// suite runs once at pre-push (see the `prepush` npm script). This avoids the
// ~30s-per-commit cost that pushes developers toward `--no-verify`, while still
// blocking broken code before it leaves the machine.
