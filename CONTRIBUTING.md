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

### Branching Strategy
- `main` - Production-ready code
- `dev` - Development branch (auto-deploys via GitHub Actions)
- Feature branches: Create from `main`, merge back to `main` via PR

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

### Deployment
Merging to `dev` triggers automatic deployment:
1. GitHub Actions builds Docker image
2. Image pushed to AWS ECR
3. Kubernetes deployment updated in the cluster

Deployment manifests are in `deployments/templates/`:
- `deployment.yml` - Pod configuration
- `service.yml` - Service definition
- `ingress.yml` - Ingress rules

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

### Development Mode

When running `npm run start:dev`, nodemon watches for changes to `.css`, `.scss`, `.js`, `.json`, and `.njk` files and automatically restarts the server. You'll still need to rebuild CSS/JS manually or set up additional watch processes.

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

### Docker Compose
*(To be documented)*

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
