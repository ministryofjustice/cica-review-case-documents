# Tasks: Remove Committed Build Artifacts

## Phase 1: Multi-stage Dockerfile

- [ ] 1. Convert `Dockerfile` to a two-stage build
  - Stage 1 (builder): `npm ci` with all deps, `COPY . .`, run `npm run sass && npm run build`
  - Stage 2 (runtime): copy app + pruned node_modules + built `public/` from builder
  - Retain non-root user, npm removal, and `CMD ["node", "./bin/www"]`
- [ ] 2. Verify `.dockerignore` excludes `node_modules/` and `coverage/` from build context
- [ ] 3. Test Docker build: `docker build -t cica-test .` and confirm `public/stylesheets/all.css` and `public/js/bundle.js` exist in the image

## Phase 2: Gitignore generated assets

- [ ] 4. Add to `.gitignore`:
  - `public/stylesheets/all.css`
  - `public/js/bundle.js`
  - `src/js/scripts.babel.generated.js`
- [ ] 5. Remove from git tracking: `git rm --cached public/stylesheets/all.css public/js/bundle.js src/js/scripts.babel.generated.js`

## Phase 3: Dev startup — build assets and watch SCSS

- [ ] 6. Add `sass:watch` script to `package.json`:
  ```
  "sass:watch": "sass --watch --quiet-deps --load-path=. --style=compressed --no-source-map src/sass/all.scss public/stylesheets/all.css"
  ```
- [ ] 7. Update `prestart:dev` to build all assets before server start:
  ```
  "prestart:dev": "npm run openapi:build && npm run sass && npm run build:dev"
  ```
- [ ] 8. Update `start:dev` to run dev server and sass watcher concurrently:
  ```
  "start:dev": "concurrently --names server,sass \"npm run dev:server\" \"npm run sass:watch\""
  ```

## Phase 4: Simplify pre-commit hook

- [ ] 9. Remove SCSS logic from `scripts/hooks/precommit-staged.js`:
  - Delete `hasStagedScssChanges()` function
  - Delete `getTrackedScssFiles()` function
  - Delete `getUntrackedScssFiles()` function
  - Remove the `hasScssChanges` variable and all conditionals guarding SCSS checks
  - Remove the Sass compilation call
  - Remove `git add -- public/stylesheets/all.css` restaging
- [ ] 10. Keep in the hook:
  - `getStagedFiles()` and partial-staging guard
  - Biome check on staged `.js`/`.json` files
  - Restaging of Biome-modified files

## Phase 5: Update documentation

- [ ] 11. Update `README.md`:
  - Simplify Quick Start: after `npm install` + env setup, just `npm run start:dev`
  - Remove any mention of needing to run `npm run sass` or `npm run build:dev` manually before starting
  - Note in Building Assets section that these are handled automatically by `start:dev`
- [ ] 12. Update `CONTRIBUTING.md`:
  - Simplify pre-commit description (Biome + secrets only, no Sass)
  - Remove "Staged Helper Safety Rules" section about SCSS
  - Update Git Hooks table description
- [ ] 13. Update `.kiro/steering/tech.md` if common commands reference changes

## Phase 6: Verification

- [ ] 14. Run `npm test` — confirm tests pass without committed CSS/JS
- [ ] 15. Run `npm run lint` — confirm no lint failures
- [ ] 16. Run `npm run start:dev` from a clean state (no `public/stylesheets/all.css` on disk) — confirm app starts and serves styled pages
- [ ] 17. Edit an `.scss` file while `start:dev` is running — confirm CSS recompiles automatically
- [ ] 18. Run `docker build -t cica-test .` — confirm image builds and contains assets
