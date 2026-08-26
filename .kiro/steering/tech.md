# Tech Stack

## Runtime & Framework
- Node.js >= 24.15.0 (ES modules, `"type": "module"`)
- Express.js v5
- Nunjucks template engine

## Data & Storage
- OpenSearch for document indexing and search
- AWS S3 for document page images (LocalStack for local dev)
- AWS SDK v3 (`@aws-sdk/client-s3`)

## Frontend Assets
- Sass (SCSS) compiled to CSS
- Babel + Webpack for JavaScript bundling
- GOV.UK Frontend + @ministryofjustice/frontend design system

## Authentication & Security
- Microsoft Entra ID (OIDC authorization code flow)
- JWT for app-to-API communication (`jsonwebtoken`)
- CSRF protection via `csrf-csrf`
- Helmet for HTTP security headers (nonce-based CSP)
- express-rate-limit

## Code Quality
- Biome for formatting and linting
- ESLint only for JSDoc checks (`npm run jsdoc:check`)
- Husky for git hooks (pre-commit, pre-push)
- gitleaks for secret scanning

## Testing
- Node.js built-in test runner (not Jest, not Mocha)
- c8 for code coverage
- supertest for HTTP integration tests
- Test files co-located with source, suffix `.test.js`
- Environment loaded from `.env.test`

## API Documentation
- OpenAPI 3.1 spec at `api/openapi/openapi.json`
- Built/bundled to `api/openapi/openapi-dist.json`
- Swagger UI served at `/api/docs`

## Deployment
- Docker container
- Kubernetes (Helm-style templates in `deployments/`)
- GitHub Actions CI/CD
- Snyk for container security scanning

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm test` | Run all tests (c8 + node test runner) |
| `npm run lint` | Biome lint check |
| `npm run format` | Biome format (write) |
| `npm run sass` | Compile SCSS to CSS |
| `npm run build` | Production JS build (babel + webpack) |
| `npm run build:dev` | Dev JS build with source maps |
| `npm run openapi:build` | Build OpenAPI dist spec |
| `npm run dev:server` | Dev server with nodemon + inspector |
| `npm run sass:watch` | Sass watch mode (auto-recompile on change) |
| `npm run jsdoc:check` | ESLint JSDoc validation |
| `npm run quality:fix` | Format + lint fix + sass + secrets + openapi |
| `npm run quality:verify` | Lint check + secrets scan (non-mutating) |
