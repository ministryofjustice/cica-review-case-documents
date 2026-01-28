# Internal Redirect Allowlist

This project uses a strict allowlist and pattern-based approach to control which internal URLs are eligible for redirects (for example, when enforcing the presence of a `crn` query parameter). This is critical for security and is enforced by the `enforceCrnInQuery` middleware.

## How it works

- **Static allowlist:** Only explicitly listed static paths (e.g., `/search`) are eligible for redirects.
- **Pattern allowlist:** Dynamic routes (such as document viewing pages) are matched using strict regular expressions (e.g., `/document/<UUID>/view/image/page/<pageNumber>`), ensuring only valid, expected paths are allowed.
- **Hardening:** Additional checks block suspicious or malformed paths (e.g., those containing `//`, `..`, protocol strings, or backslashes).

## Adding or updating allowed redirect paths

1. **Update the allowlist or pattern list:**
  - Edit `middleware/enforceCrnInQuery/index.js` to add your new static path to `ALLOWED_PATHS` or a new regex to `ALLOWED_PATH_PATTERNS`.
2. **Update tests:**
  - Add or update tests in `middleware/enforceCrnInQuery/allowList.test.js` to cover your new route or pattern.
3. **Review security:**
  - Ensure your pattern is as strict as possible to avoid over-matching.
  - Never allow user input to directly control redirect destinations without validation.

## Example

To allow a new static path `/foo`, add it to `ALLOWED_PATHS`:

```js
const ALLOWED_PATHS = ['/search', '/foo'];
```

To allow a new dynamic route, add a strict regex to `ALLOWED_PATH_PATTERNS`:

```js
const ALLOWED_PATH_PATTERNS = [
  /^\/document\/[0-9a-fA-F-]{36}\/view\/image\/page\/\d+$/,
  /^\/foo\/[a-z]+\/bar$/
];
```

## Why is this important?

Allowlisting and hardening prevent open redirect vulnerabilities and ensure only safe, intended routes are eligible for internal redirection. This is a key security requirement and is checked by automated tools (e.g., CodeQL).

If you have questions, ask a maintainer or see the code in `middleware/enforceCrnInQuery/index.js` and `allowList.test.js`.
# Contributing to FIND

Thank you for contributing to the CICA Review Case Documents (FIND) application! This guide provides detailed information about the development workflow, project structure, and best practices.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Building Assets](#building-assets)
- [Security](#security)
- [Code Quality](#code-quality)
- [Troubleshooting](#troubleshooting)
- [Accessibility](#accessibility)

## Development Workflow

### Installing Dependecies
Run `npm install` as expected, then run:
```
npx husky init
```
Husky will now use the scripts defined in the `/.husky` folder, which are currently: 
```
pre-commit
pre-push
```

>pre-commit runs `npm run lint`and pre-push runs `npm run test`. If there are linting errors running `npm run lint -- --fix` will clear the most common issues.

### Branching Strategy
- Feature branches: Create from `main`, merge back to `main` via PR
- see [Branching Strategy](https://dsdmoj.atlassian.net/wiki/spaces/CICAIET/pages/5582979882/Branching+Strategy)

### Making Changes
1. Create a feature branch from `main`
   ```bash
   git checkout main
   git pull
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run linting: `npm run lint` (enforced by pre-commit hook)
4. Run tests: `npm test` (enforced by pre-push hook)
5. Commit your changes with descriptive messages
6. Push to your branch
7. Create a Pull Request to merge into `main`
8. After review and approval, merge to `main`

### Git Hooks (Husky)

The project uses Husky for Git hooks:

| Hook Name  | Action       | Description                          |
| ---------- | ------------ | ------------------------------------ |
| pre-commit | npm run lint | Runs Biome linter before commit      |
| pre-push   | npm test     | Runs all tests before push           |


### CI/CD Pipeline

#### Automated Tests (`tests.yml`)
- **Triggers**: Runs on every push and pull request
- **Actions**: Linting, JSDoc validation, and unit tests
- **Node.js version**: 22.8.0

#### Deployment Workflow (`deploy.yml`)
The deployment process consists of two stages:

##### 1. Build and Scan
- Builds Docker image with the commit SHA as the tag
- Runs Trivy security scanning:
  - **Breaking scan**: Fails on CRITICAL/HIGH vulnerabilities
  - **Informative scan**: Reports all vulnerabilities without failing
- Pushes image to Amazon ECR

##### 2. Deploy
- Templates Kubernetes manifests with the built image
- Deploys to the specified environment (dev/prod)

##### Manual Deployment
Deployments can be triggered manually via workflow dispatch:
- Select environment (dev/prod)
- Specify branch/ref to deploy
- Optional: Skip security scan for emergency deployments (not recommended)

##### Security Scanning
Uses Trivy to scan for vulnerabilities. See `.trivyignore` for suppressed CVEs.

Environment variables are substituted during CI/CD deployment.

## Technology Stack

### Core Technologies
- **Runtime**: Node.js v22.8.0+
- **Framework**: Express.js v5
- **Template Engine**: Nunjucks
- **Search**: OpenSearch (AWS)
- **CSS**: Sass (SCSS)
- **JavaScript**: ES6+ (Babel + Webpack)

### Development Tools
- **Linting**: Biome
- **Testing**: Node.js Test Runner
- **Package Manager**: npm v10.8.2+
- **Containerization**: Docker + Kubernetes

### Key Dependencies
- **Security**: csrf-csrf, express-session, cookie-parser, helmet
- **Logging**: Pino (pino-http, pino-pretty)
- **Validation**: express-openapi-validator
- **HTTP Client**: got
- **Design System**: @ministryofjustice/frontend, GOV.UK Frontend

For a complete list of dependencies, see [`package.json`](./package.json).

## Project Structure

```
api/                    - REST API routes and OpenAPI specification
  openapi/              - OpenAPI spec and JSON schemas
    openapi.json        - API documentation (OpenAPI 3.1)
  search/               - Search API implementation
bin/                    - Application entry point (www)
components/             - Custom client-side components
  cica/                 - CICA-specific components (Sass, Nunjucks)
db/                     - OpenSearch database connection layer
deployments/            - Kubernetes deployment templates
  templates/            - K8s YAML templates (deployment, ingress, service)
document/               - Document data access layer
index/                  - Root-level pages (Nunjucks templates)
middleware/             - Express middleware
  caseSelected/         - Validates case is selected
  csrf/                 - CSRF protection
  ensureEnvVarsAreValid/ - Environment variable validation
  errorHandler/         - Global error handling
  getCaseReferenceNumberFromQueryString/ - Extracts CRN from query params
  logger/               - Request/response logging (Pino)
page/                   - Base Nunjucks page templates
partial/                - Reusable Nunjucks partials
public/                 - Static assets (compiled CSS/JS)
  js/                   - Bundled JavaScript
  stylesheets/          - Compiled CSS
search/                 - Search functionality
  macro/                - Nunjucks macros for search UI
  page/                 - Search-specific page templates
  routes.js             - Search route handlers
  search-service.js     - Search business logic
service/                - Shared services
  request/              - HTTP request wrapper (using 'got')
src/                    - Source files (pre-compilation)
  js/                   - JavaScript source
  sass/                 - Sass source files
templateEngine/         - Nunjucks template rendering service
```

## Testing

This application uses the [Node.js Test Runner](https://nodejs.org/api/test.html).

### Running Tests

```bash
# Run all tests
npm test

# Run tests in a specific file
node --env-file=.env.test --test search/routes.test.js

# Run tests matching a pattern
node --env-file=.env.test --test --test-name-pattern="search"
```

### Test File Structure
- Test files use `.test.js` suffix (e.g., `routes.test.js`)
- Tests are co-located with source files
- Uses Node.js built-in `mock` module for mocking
- Test suites use `.env.test` file for environment variables

### Writing Tests

Tests use Node.js test runner with descriptive `describe` and `it` blocks:

```javascript
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

describe('my feature', () => {
    beforeEach(() => {
        // Setup
    });

    afterEach(() => {
        // Cleanup
        mock.restoreAll();
    });

    it('should do something', () => {
        assert.strictEqual(actual, expected);
    });
});
```

### Best Practices
- Write descriptive test names that explain what is being tested
- Use `beforeEach` and `afterEach` for setup/teardown
- Mock external dependencies (database, API calls)
- Test both success and error cases
- Maintain high test coverage for critical paths

## Building Assets

### CSS (Sass)

This project uses [Sass](https://sass-lang.com/) for styling.

**Entry point:** `./src/sass/all.scss`  
**Output:** `./public/stylesheets/all.css`

```bash
# Compile Sass to CSS
npm run sass
```

The compiled CSS is automatically referenced in the page templates and should not be edited directly.

### JavaScript (Babel + Webpack)

This project uses [Babel](https://babeljs.io/) for transpilation and [Webpack](https://webpack.js.org/) for bundling.

**Entry point:** `./src/js/scripts.js`  
**Output:** `./public/js/bundle.js`

```bash
# Build for development (with source maps)
npm run build:dev

# Build for production (minified)
npm run build

# Run individual steps
npm run babel      # Transpile only
npm run webpack:dev # Bundle for development
npm run webpack     # Bundle for production
```

### OpenAPI Specification

The API documentation is generated from the OpenAPI schema files.

**Entry point:** `./api/openapi/openapi.json`  
**Output:** `./api/openapi/openapi-dist.json`

```bash
# Build the OpenAPI specification
npm run openapi:build

# Watch for changes and rebuild automatically (optional)
npm run openapi:watch
```

**When to rebuild:**
- After modifying `api/openapi/openapi.json`
- After changing JSON schemas in `api/openapi/json-schemas/`
- After updating API endpoints or route definitions
- Before accessing Swagger UI at `/api-docs`

**Note:** The OpenAPI build is NOT automatically included in `npm run start:dev`. You must manually run `npm run openapi:build` or use `npm run openapi:watch` in a separate terminal when working on API schema changes.

**Swagger UI and CSP:**  
Swagger UI requires inline scripts, which conflicts with our Content Security Policy (CSP). The application implements a CSP workaround specifically for the `/api-docs` route by relaxing the `script-src` directive to allow Swagger UI to function. This is an acceptable trade-off for developer documentation endpoints. The workaround is implemented in the `helmet` configuration when serving Swagger UI.

### Development Mode

When running `npm run start:dev`, nodemon watches for changes to `.css`, `.scss`, `.js`, `.json`, and `.njk` files and automatically restarts the server. You'll still need to rebuild CSS/JS manually or set up additional watch processes.

**Note:** The OpenAPI specification is NOT automatically rebuilt during development. Run `npm run openapi:watch` in a separate terminal if you're actively working on the API schema.

## Security

### CSRF Protection

The application implements CSRF protection using the `csrf-csrf` package:

- CSRF tokens are generated per session
- Tokens must be included in all state-changing requests (POST, PUT, DELETE)
- Tokens are validated automatically by the middleware
- Forms must include: `<input type="hidden" name="_csrf" value="{{ csrfToken }}">`

**Implementation:**
- Middleware: `middleware/csrf/`
- Token available in templates as `csrfToken`

### Cookie Security

Cookies are configured with security best practices:

- `httpOnly` flag prevents JavaScript access (XSS mitigation)
- `secure` flag enabled in production (HTTPS only)
- `sameSite` attribute prevents CSRF attacks
- Session secret loaded from `APP_COOKIE_SECRET` environment variable

**Important:** Never hardcode secrets. Use environment variables.

### Content Security Policy (CSP)

The application uses nonce-based CSP for inline scripts:

- Nonces are generated per request
- Available in templates via `cspNonce` variable
- Use for inline scripts: `<script nonce="{{ cspNonce }}">`

Example:
```html
<script nonce="{{ cspNonce }}">
    // Your inline script
</script>
```

### Logging & Redaction

Sensitive data is automatically redacted from logs using Pino:

- **Configure redaction:** Set `APP_LOG_REDACT_EXTRA` with comma-delimited paths
  - Example: `req.body.password,req.headers["authorization"]`
- **Disable redaction:** Set `APP_LOG_REDACT_DISABLE=true` (development only)
- **Log level:** Configure via `APP_LOG_LEVEL` (error, warn, info, debug, trace)

**Default redacted fields:**
- `req.headers.cookie`
- `req.headers.authorization`
- Session data

### Environment Variables

**Security best practices:**
- **Never commit `.env` files** (excluded in `.gitignore`)
- Use `.env.example` as a template
- Use environment-specific secrets in production (AWS Secrets Manager, K8s Secrets)
- Validate required variables on start up (see `ensureEnvVarsAreValid` middleware)

**Adding new environment variables:**
1. Add to `.env.example` with example value
2. Add to `ensureEnvVarsAreValid` middleware for validation
3. Document in README or this file
4. Update deployment configuration

### Input Validation

- API validation handled by `express-openapi-validator`
- Validates requests against OpenAPI schema (`api/openapi/openapi.json`)
- Nunjucks auto-escapes HTML by default (use `| safe` filter cautiously)
- Never trust user input - always validate and sanitize

## Code Quality

### Biome (Linter & Formatter)

Biome is configured in `biome.json` at the root of the project.

```bash
# Check code (lint)
npm run lint

# Format code
npm run format
```

[Full Biome documentation](https://biomejs.dev/reference/configuration/)

### VS Code Setup

1. Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
2. Update `.vscode/settings.json`:

```json
{
    "editor.defaultFormatter": "biomejs.biome",
    "editor.formatOnSave": true,
    "prettier.enable": false,
    "eslint.enable": false,
    "biome.enabled": true,
    "[javascript]": {
        "editor.tabSize": 4,
        "editor.defaultFormatter": "biomejs.biome"
    },
    "[json]": {
        "editor.tabSize": 4,
        "editor.defaultFormatter": "biomejs.biome"
    }
}
```

### Code Style Guidelines

- Use 4 spaces for indentation
- Use camelCase for variables and functions
- Use PascalCase for classes
- Use UPPER_SNAKE_CASE for constants
- Write descriptive variable and function names
- Add JSDoc comments for complex functions
- Keep functions small and focused (single responsibility)

### Redirect Allowlist for Internal Redirects

For security and compliance with CodeQL rules, the application uses an explicit allowlist of redirect-eligible routes in the `enforceCrnInQuery` middleware (see `middleware/enforceCrnInQuery/index.js`). Only routes in this allowlist (e.g., `/search`) are permitted as redirect targets.

**If you add a new route that should support internal redirects:**
- Update the `ALLOWED_PATHS` array in `middleware/enforceCrnInQuery/index.js`.
- Update the corresponding test in `middleware/enforceCrnInQuery/allowList.test.js` to include the new route.
- This ensures that all redirects remain secure and that automated tests will fail if the allowlist and test are not kept in sync.

See the comments in both files for more details.

## Troubleshooting

### OpenSearch Connection Failed

**Error:** Cannot connect to OpenSearch database

**Solutions:**
1. Verify `APP_DATABASE_URL` is correct: `http://localhost:9200`
2. Ensure OpenSearch is running (check [airflow setup](https://github.com/ministryofjustice/cica-review-case-documents-airflow))
3. Test connection: `curl http://localhost:9200`
4. Check network connectivity and firewall rules

### Case Reference Number Required

**Error:** Redirected to `/case` or no search results

**Solution:** Add `caseReferenceNumber` query parameter to URL:
```
http://localhost:5000/search?caseReferenceNumber=25-111111
```

Available parameters: `caseReferenceNumber` or `crn` (alias)

### CSRF Token Errors

**Error:** 403 Forbidden or "Invalid CSRF token"

**Solutions:**
1. Ensure forms include CSRF token field:
   ```html
   <input type="hidden" name="_csrf" value="{{ csrfToken }}">
   ```
2. Check session cookie is being set (inspect browser DevTools)
3. Verify `APP_COOKIE_SECRET` is configured in `.env`
4. Clear browser cookies and try again

### Environment Variable Validation Errors

**Error:** Application fails to start with missing environment variable

**Solutions:**
1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Update `.env` with actual values
3. Check `middleware/ensureEnvVarsAreValid/` for required variables
4. Restart the application

### Build Errors

**Problem:** CSS or JS not updating

**Solutions:**
1. Rebuild CSS: `npm run sass`
2. Rebuild JS: `npm run build:dev`
3. Check file permissions in `public/` directory
4. Clear browser cache (hard refresh: Ctrl+Shift+R)
5. Check for syntax errors in source files

### Debugging

Start the application with debugger enabled:

```bash
npm run start:dev
```

The debugger listens on port `9229`. Attach using:

- **VS Code:** Add launch configuration (see `.vscode/launch.json`)
- **Chrome DevTools:** Navigate to `chrome://inspect`

**Debugging tips:**
- Use `console.log()` for quick debugging (remember to remove)
- Use `debugger;` statements for breakpoints
- Check application logs in the terminal
- Use Chrome DevTools Network tab for API debugging

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::5000`

**Solutions:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

## Accessibility

This application follows [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/) standards.

### Standards & Guidelines
- Uses GOV.UK Design System components (built-in accessibility)
- Semantic HTML structure
- Proper heading hierarchy (h1, h2, h3...)
- ARIA labels where appropriate
- Keyboard navigation support
- Sufficient colour contrast (minimum 4.5:1 for text)

### Accessibility Statement
The application provides an accessibility statement at `/accessibility-statement`.

### Testing Accessibility

**Automated Testing:**
- Use browser extensions:
  - [axe DevTools](https://www.deque.com/axe/devtools/)
  - [WAVE](https://wave.webaim.org/extension/)
- Run automated checks regularly during development

**Manual Testing:**
- **Keyboard navigation:** Navigate using Tab, Shift+Tab, Enter, Space
- **Screen readers:**
  - [NVDA](https://www.nvaccess.org/) (Windows, free)
  - [JAWS](https://www.freedomscientific.com/products/software/jaws/) (Windows, commercial)
  - VoiceOver (macOS, built-in)
- **Zoom:** Test at 200% and 400% zoom levels
- **Colour blindness:** Use simulators to check colour contrast

### Best Practices
- Use semantic HTML elements (`<nav>`, `<main>`, `<article>`)
- Provide alt text for images
- Ensure form labels are associated with inputs
- Use skip links for keyboard navigation
- Test with actual assistive technologies
- Regular accessibility audits recommended

## Docker

### Build Image
```bash
docker build -t cica-review-case-documents .
```

### Run Container
```bash
docker run -p 5000:5000 \
  -e APP_COOKIE_NAME=mycookie \
  -e APP_COOKIE_SECRET=yoursecrethere \
  -e APP_DATABASE_URL=http://opensearch:9200 \
  -e APP_API_URL=http://localhost:5000/api \
  -e OPENSEARCH_INDEX_CHUNKS_NAME=page_chunks \
  cica-review-case-documents
```

#### Database Connection

The application connects to an OpenSearch database. The connection URL is configured via the `APP_DATABASE_URL` environment variable in the `.env` file.

-   **For standard local development**, the database is expected to be running on `localhost`:
    ```
    APP_DATABASE_URL=http://127.0.0.1:9200
    ```

-   **When running in a local Kubernetes cluster (e.g., via Docker Desktop)**, the application container needs to connect to a service running on the host machine. Use `host.docker.internal` to allow the container to resolve the host's IP address:
    ```
    APP_DATABASE_URL=http://host.docker.internal:9200
    ```
    see [local docker desktop kube deployments](/deployments/local/README.md)

### Docker Compose
*(To be documented)*

### Local docker desktop production like environment changes and testing

see [local docker desktop kube deployments](/deployments/local/README.md)

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [OpenSearch Documentation](https://opensearch.org/docs/latest/)
- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [Ministry of Justice Frontend](https://github.com/ministryofjustice/moj-frontend)
- [Biome Documentation](https://biomejs.dev/)

## Getting Help

- Check this document first
- Review existing issues on GitHub
- Contact the team via email: IET@cica.gov.uk
- Create a new issue with detailed information

---

Thank you for contributing to FIND!

