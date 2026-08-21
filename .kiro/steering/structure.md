# Project Structure

## Architecture

Three-tier: Browser → Main App (Express, port 5000) → API / S3

- Browser never talks directly to API or S3.
- Main app is the gateway: streams images from S3, proxies metadata from API.
- API queries OpenSearch only; does not handle binary content.

## Top-Level Layout

```
app.js                  - Main Express app setup and middleware registration
bin/                    - Entry point (www)
api/                    - Internal REST API (mounted at /api)
  app.js                - API-specific Express app and middleware
  auth/                 - API JWT claims validation
  DAL/                  - Data Access Layer (OpenSearch queries)
  document/             - Document/page routes and services
  openapi/              - OpenAPI spec source and build output
auth/                   - Entra ID auth routes, handlers, and helpers
search/                 - Search feature (routes, service, macros, templates)
document/               - Document viewing feature (main app side)
middleware/             - Main app middleware (camelCase folder names)
components/cica/        - UI components (kebab-case folder names)
  <component-name>/
    template.njk
    macro.njk
    _component.scss
    template.test.js
db/                     - OpenSearch connection layer
service/                - Shared services (e.g. HTTP request wrapper)
utils/                  - Shared utilities
src/
  js/                   - Client JS source (Babel input)
  sass/                 - SCSS source (entry: all.scss)
public/                 - Compiled static assets (CSS, JS)
page/                   - Base Nunjucks page layouts
partial/                - Reusable Nunjucks partials
index/                  - Root-level page templates
templateEngine/         - Nunjucks rendering configuration
deployments/            - Kubernetes manifest templates
scripts/                - Build/hook helper scripts
test/                   - Shared test utilities
```

## Conventions

- Middleware folders use camelCase: `middleware/caseSelected/`
- Component folders use kebab-case: `components/cica/identity-bar-with-sub-nav/`
- Test files live beside their source: `index.js` + `index.test.js`
- Private helpers stay inside the owning module folder
- Feature logic stays in its own feature folder
- Main-app middleware registered in `app.js`; API middleware in `api/app.js`
- `.js` extension only (no `.mjs`)
