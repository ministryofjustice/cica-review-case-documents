# CICA Review Case Documents — Agent Guidelines

Keep this file limited to stable repo rules. Use [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [CONTRIBUTING.md](./CONTRIBUTING.md) for fuller project guidance.

## Code Style

- Use Biome for formatting and general linting (ESLint is used only for JSDoc checks via `npm run jsdoc:check`).
- Keep `if` and other control-flow statements in braces, even for single-line bodies.
- Use camelCase for functions and variables.
- Use kebab-case for UI component folder names under `components/cica/`.
- Use `.js` files by default; do not introduce `.mjs` files.
- Use Nunjucks only for templates.
- Use British English explicitly and exclusively in all user-facing and developer-facing written content, including documentation, comments, copy, commit messages, and implementation details.

## Core Rules

- Use the Node test runner only. Test files live beside the code they cover and end in `*.test.js`.
- Keep middleware and utility folders in camelCase.
- Keep private helpers inside the owning module folder.

## Routing And Middleware

- Register main-app middleware in `app.js` (API middleware is registered in `api/app.js`)
- Keep feature logic in the owning feature folder.

## Module & Folder Structure

Modules are organized by feature or domain:

```text
middleware/
├── moduleName/
│   ├── index.js
│   ├── index.test.js
│   └── utils/
│       ├── helper.js
│       └── helper.test.js
utils/
├── utilityName/
│   ├── index.js
│   ├── index.test.js
│   └── supporting files
components/
├── cica/
│   ├── component-name/
│   │   ├── template.njk
│   │   ├── macro.njk
│   │   ├── _component.scss
│   │   ├── template.test.js
│   │   └── README.md
```

## SCSS

- Preserve the import order in `src/sass/all.scss`: import `@ministryofjustice/frontend` before `govuk-frontend`.
- Use the underscore prefix for partials such as `_component.scss`.

## Environment Files

- Use `.env.example` as the template for local environment setup.
- Use `.env.test` for test runs.
- Do not commit real secret values to any `.env` file.
- Required auth env vars include `APP_BASE_URL`, `APP_API_JWT_ISSUER`, and `APP_API_JWT_AUDIENCE`.
- Treat required variables as documented in [README.md](./README.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## Architecture

- The browser never talks directly to API or S3; the main app is the gateway.
- Browser requests go browser → main app → API for metadata, and browser → main app → S3 for images.
- Browser code should never call API or S3 endpoints directly.

## Common Commands

- `npm install`
- `npm test`
- `npm run format`
- `npm run lint`
- `npm run sass`
- `npm run openapi:build`
- `npm run dev:server`

## Validation

- Use `npm test`, `npm run lint`, `npm run format`, `npm run sass`, and `npm run openapi:build` as the main checks for changes here.
