# Design: Remove Committed Build Artifacts

## Overview

Move asset compilation (Sass → CSS, Babel + Webpack → JS) from a committed-file workflow into the Docker image build. Git will no longer track generated output. The pre-commit hook is simplified to Biome-only.

## Dockerfile — Multi-Stage Build

```dockerfile
# --- Stage 1: builder ---
FROM node:<version>-trixie-slim AS builder

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run sass && npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# --- Stage 2: runtime ---
FROM node:<version>-trixie-slim

WORKDIR /usr/src/app

# Copy production node_modules and built app from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app .

# Remove dev tooling that shouldn't be in runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Non-root user
RUN groupadd -g 1014 dc_user && useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user
RUN chown -R dc_user:dc_user /usr/src/app
USER 1015

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

CMD ["node", "./bin/www"]
```

### Key decisions

1. The builder stage runs `npm ci` (all deps) so Sass, Babel, and Webpack are available.
2. `npm prune --omit=dev` removes devDependencies after the build step, so only production deps are copied to runtime.
3. The full app is copied into the runtime stage, but since `public/` is overwritten by COPY --from=builder, the generated assets are always fresh from the build.
4. A `.dockerignore` update ensures `node_modules/` and `coverage/` are not sent to the Docker context.

## .gitignore Changes

Add these entries:

```
public/stylesheets/all.css
public/js/bundle.js
src/js/scripts.babel.generated.js
```

After updating `.gitignore`, remove from tracking:

```bash
git rm --cached public/stylesheets/all.css public/js/bundle.js src/js/scripts.babel.generated.js
```

## Pre-commit Hook Simplification

### Before (precommit-staged.js responsibilities)
1. Detect staged files
2. Guard against partial staging
3. Run Biome on staged .js/.json files
4. Detect SCSS changes
5. Guard against unstaged SCSS / untracked SCSS
6. Run Sass compiler
7. Re-stage modified files + generated CSS

### After (precommit-staged.js responsibilities)
1. Detect staged files
2. Guard against partial staging (for Biome-touched files only)
3. Run Biome on staged .js/.json files
4. Re-stage Biome-modified files

All SCSS-related logic (steps 4–7) is removed entirely. The `hasStagedScssChanges`, `getTrackedScssFiles`, `getUntrackedScssFiles` functions are deleted.

## Local Development Workflow

After `npm install`, developers run `npm run start:dev`. That's it.

### How it works

1. npm auto-runs `prestart:dev` before `start:dev`.
2. `prestart:dev` builds all assets up front: OpenAPI spec, CSS, and JS.
3. `start:dev` launches the dev server and a Sass watcher concurrently.

### Script changes in `package.json`

```json
"sass:watch": "sass --watch --quiet-deps --load-path=. --style=compressed --no-source-map src/sass/all.scss public/stylesheets/all.css",
"prestart:dev": "npm run openapi:build && npm run sass && npm run build:dev",
"start:dev": "concurrently --names server,sass \"npm run dev:server\" \"npm run sass:watch\""
```

- `sass:watch` — long-running process that recompiles on any SCSS change.
- `prestart:dev` — one-shot build so assets exist before the server starts serving requests.
- `start:dev` — runs dev server + sass watcher in parallel via `concurrently` (already a devDependency).

### Why both `prestart:dev` and `sass:watch`?

The watch process detects changes but doesn't guarantee a build happened before the server starts. Running `npm run sass` in `prestart:dev` ensures CSS exists on first request. The watcher then keeps it current as developers edit SCSS.

## Documentation Updates

### README.md
- Add a step between "Install Dependencies" and "Run the Application" telling devs to run `npm run sass && npm run build:dev` (or `npm run dev:setup`).

### CONTRIBUTING.md
- Update the pre-commit hook description to note it only runs Biome checks.
- Remove references to SCSS compilation in the hook.
- Remove the staged helper safety rules about SCSS partial staging.

### AGENTS.md
- No changes needed (it doesn't reference committing CSS).

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Dev forgets to build assets after clone | `dev:setup` script + README step; `dev:server` will serve without CSS/JS (obvious failure) |
| Docker build time increases | Minimal — Sass/Webpack add ~5–10s; caching of `npm ci` layer helps |
| Existing PRs with CSS changes get conflicts | One-time migration; communicate to team |
| Tests that reference `public/` files | Unlikely — tests use supertest against the app which doesn't serve static files in test mode; verify |

## Migration Steps

See `tasks.md` for the ordered implementation plan.
