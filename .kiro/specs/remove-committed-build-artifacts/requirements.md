# Requirements: Remove Committed Build Artifacts

## Problem Statement

Generated files (`public/stylesheets/all.css`, `public/js/bundle.js`, `src/js/scripts.babel.generated.js`) are currently committed to git. This forces the pre-commit hook to include complex SCSS regeneration/restaging logic (`scripts/hooks/precommit-staged.js`) to keep the committed CSS deterministic in the face of partial staging. The complexity is disproportionate to the benefit.

## Goal

Adopt the standard pattern: **build generated assets in CI/Docker only, never commit them to git.**

This eliminates:
- The Sass compilation and restaging logic in the pre-commit hook
- The partial-staging guards for SCSS files
- The need to commit `public/stylesheets/all.css`, `public/js/bundle.js`, or `src/js/scripts.babel.generated.js`

## Requirements

### REQ-1: Multi-stage Docker build
- Convert the Dockerfile to a two-stage build:
  - **Stage 1 (builder):** Install all dependencies (including dev), run `npm run sass` and `npm run build` to produce CSS and JS artifacts.
  - **Stage 2 (runtime):** Copy only production `node_modules` and built artifacts from stage 1 into a slim runtime image. No dev dependencies or build tooling in the final image.
- The runtime stage must not contain `sass`, `webpack`, `babel`, or `devDependencies`.
- Keep the existing security hardening (non-root user, no npm binary in runtime).

### REQ-2: Gitignore generated assets
- Add `public/stylesheets/all.css`, `public/js/bundle.js`, and `src/js/scripts.babel.generated.js` to `.gitignore`.
- Remove these files from git tracking (they remain on disk for local dev).

### REQ-3: Simplify the pre-commit hook
- Remove all Sass compilation and CSS restaging logic from `scripts/hooks/precommit-staged.js`.
- Keep Biome check-and-fix on staged `.js`/`.json` files (existing behaviour).
- Keep the partial-staging guard for files that Biome will modify (existing behaviour).
- Remove the SCSS-specific partial-staging guards and untracked-SCSS checks (no longer needed).

### REQ-4: CI tests workflow still passes
- The `tests.yml` workflow runs `npm run prepush` which calls `npm run quality:verify && npm run test`.
- Neither of these require committed CSS/JS, so no workflow changes should be needed.
- Verify that removing committed assets doesn't break any test that reads from `public/`.

### REQ-5: Deployment workflow still works
- The `deploy.yml` workflow calls `docker build`. Since the Dockerfile now builds assets internally, no workflow changes should be needed.
- Confirm the OpenAPI build (`npm run openapi:build`) is also handled (it already runs in `prestart:dev` and is not committed).

### REQ-6: Local development experience preserved
- After `npm install`, developers run `npm run start:dev` and the app starts with all assets built. No extra manual steps.
- `prestart:dev` builds OpenAPI spec, CSS, and JS before the server starts.
- A `sass:watch` process runs concurrently with the dev server so SCSS edits compile automatically without restarting.
- `npm run build:dev` is triggered as part of `prestart:dev` for JS bundling.

### REQ-7: Update documentation
- Update README.md Quick Start to mention running asset builds before first start.
- Update CONTRIBUTING.md pre-commit section to reflect the simplified hook.
- Update AGENTS.md if any rules reference committing CSS.

## Out of Scope
- Changing the Sass or Webpack tooling itself.
- Adding watch-mode build tooling (already exists via `nodemon` and `openapi:watch`).
- Changing OpenAPI spec handling (already not committed via `openapi-dist.json`).
- Adding CSS/JS to CI artefacts (not needed; Docker build produces them).
