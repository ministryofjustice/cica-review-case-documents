# FIND

[![GitHub repo size](https://img.shields.io/github/repo-size/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents)
[![GitHub repo npm version](https://img.shields.io/badge/npm_version->=10.8.2-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L5)
[![GitHub repo node version](https://img.shields.io/badge/node_version->=22.8.0-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L6)
[![GitHub repo contributors](https://img.shields.io/github/contributors/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/graphs/contributors)
[![GitHub repo license](https://img.shields.io/github/package-json/license/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/LICENSE)
<!-- [![GitHub repo version](https://img.shields.io/github/package-json/v/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/releases/latest) -->

> [!NOTE]
> To set up the Opensearch database and client, please refer to the [airflow documentation](https://github.com/ministryofjustice/cica-review-case-documents-airflow?tab=readme-ov-file#cica-review-case-documents-airflow-ingestion-pipeline).

## Prerequisites
-   You have got this running: [airflow documentation](https://github.com/ministryofjustice/cica-review-case-documents-airflow?tab=readme-ov-file#cica-review-case-documents-airflow-ingestion-pipeline)
-   You have NPM `">=10.8.2"` installed globally.
-   You have Node `">=22.8.0"` installed globally.

## Installation
Run the install:
````
npm install
````

Add the environment variables to the `.env` file:
````properties 
APP_COOKIE_NAME=somerandomname
APP_COOKIE_SECRET=somereallylongstringthatwouldbetoohardtoguessandhasalotofcharactersinit123456789
APP_SEARCH_PAGINATION_ITEMS_PER_PAGE=5
APP_API_URL=http://localhost:5000/api
APP_DATABASE_URL=http://localhost:9200
OPENSEARCH_INDEX_CHUNKS_NAME=page_chunks
APP_LOG_LEVEL=error
APP_LOG_REDACT_EXTRA=blah
APP_LOG_REDACT_DISABLE=false
````

<!-- APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE=1 -->

| Name                                   | Description                                       | Example                                                    |
| -                                      | -                                                 | -                                                          |
| PORT                                   | Port that the application will run on             | 5000                                                       |
| APP_COOKIE_NAME                        | Name of the cookie that is stored client-side     | mycookiename                                               |
| APP_COOKIE_SECRET                      | String used to encrypt the cookie                 | somereallylongstringthatisusedtoencryptthecookie....       |
| APP_SEARCH_PAGINATION_ITEMS_PER_PAGE   | Number of search results to be displayed per page | 10                                                         |
| APP_API_URL                            | URL of the document API                           | http://localhost:5000/api                                  |
| APP_DATABASE_URL                       | URL of the Opensearch database                    | http://localhost:9200                                      |
| APP_LOG_LEVEL                          | Severity level of logging output                  | error                                                      |
| APP_LOG_REDACT_EXTRA                   | Comma-delimited list of properties to redact      | 'req.body.mySecretFormField,req.headers["x-secret-thing"]' |
| APP_LOG_REDACT_DISABLE                 | Boolean to disable redaction                      | false                                                      |
| OPENSEARCH_INDEX_CHUNKS_NAME           | Name of the index used for searches               | page_chunks                                                |

## Running
Run the app:
````
npm run start:dev
````

Navigate to `http://localhost:5000/` in your browser to see the default page.

This web app is intended to be accessed via Tempus. Tempus has specific links that a user can click on to get to specific areas of this web app.

### Case Reference Number selection
In order for the user to be able to search, they need to first selected which case they are searching. This is done with a query parameter in the URL.

| Name                                   | Description                                                 |
| -                                      | -                                                           |
| caseReferenceNumber                    | The case that will be searched when a search is carried out |
| crn                                    | Alias of `caseReferenceNumber`                              |

#### Examples
http://localhost:5000/search?caseReferenceNumber=25-111111

This will select the case with the CRN `25-111111`. That should be reflected in the UI with `CRN: 25-111111` being displayed on the page. Now that the CRN is specified, you will now be able to search for a string within the documents attached to the case with the CRN `25-111111`.

http://localhost:5000/search/gabapentin%20600mg/1/5?caseReferenceNumber=25-111111

Does the same s th above URL, but also performs a search.

http://localhost:5000/search/the?caseReferenceNumber=12-121212

This CRN does not exist, so it will not return any results.

## URLs

### Search
**GET** `/search/{query}/{pageNumber}/{itemsPerPage}`

Searches for test (query) in documents within a specific case.

| Name                                   | Description                                                 |
| -                                      | -                                                           |
| query                                  | Space-delimited keywords or sentence to search for          |
| pageNumber                             | Page number of the paginated results                        |
| itemsPerPage                           | The number of items to show per page of results             |


## API
OpenAPI specification: `api/openapi/openapi.json`

### Search Endpoint
**GET** `/api/search/{query}/{pageNumber}/{itemsPerPage}`

Searches for test (query) in documents within a specific case.

**Headers:**
- `On-Behalf-Of` (required): Case reference number (e.g., `25-111111`)

**Parameters:**
| Name | Type | Description |
| - | - | - |
| query | string | Search query (keywords or phrases) |
| pageNumber | integer | Page number (starts at 1) |
| itemsPerPage | integer | Number of results per page |

**Response:**
- `200`: JSON:API formatted search results
- `400`: Validation errors
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not found

**Example:**
```bash
curl -H "On-Behalf-Of: 25-111111" \
  http://localhost:5000/api/search/gabapentin/1/10
```

## Test
This app uses the [NodeJS test runner](https://nodejs.org/api/test.html)

````
npm test
````

The test suites use the `.env.test` file as a base source of all the environment variables needed for each test.

### Test File Structure
- Test files use `.test.js` suffix (e.g., `routes.test.js`)
- Tests are co-located with source files
- Uses Node.js built-in `mock` module for mocking

### Running Specific Tests
```bash
# Run tests in a specific file
node --env-file=.env.test --test search/routes.test.js

# Run tests matching a pattern
node --env-file=.env.test --test --test-name-pattern="search"
```

### Writing Tests
Tests use Node.js test runner with descriptive `describe` and `it` blocks:
```javascript
import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

describe('my feature', () => {
    beforeEach(() => {
        // Setup
    });

    it('should do something', () => {
        assert.strictEqual(actual, expected);
    });
});
```


## Docker

### Docker Compose
TBC

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

### Kubernetes Deployment
Deployment manifests are in `deployments/templates/`:
- `deployment.yml` - Pod configuration
- `service.yml` - Service definition
- `ingress.yml` - Ingress rules

Environment variables are substituted during CI/CD deployment.


## Available npm Scripts
| Script | Description |
| - | - |
| `npm start` | Start the app in production mode |
| `npm run start:dev` | Start with nodemon, auto-reload on file changes, debugger on port 9229 |
| `npm test` | Run all tests using Node.js test runner |
| `npm run lint` | Check code with Biome linter |
| `npm run format` | Format code with Biome |
| `npm run sass` | Compile Sass to CSS |
| `npm run build` | Build production JS (Babel + Webpack) |
| `npm run build:dev` | Build development JS with source maps |
| `npm run babel` | Transpile JS with Babel |
| `npm run webpack` | Bundle JS for production |
| `npm run webpack:dev` | Bundle JS for development |


## CSS
This project uses [Sass](https://sass-lang.com/) for styling.

Build CSS:
````
npm run sass
````

Entry point:
````
./src/sass/all.scss
````

Dist:
````
./public/stylesheets/all.css
````


## JS
This project uses [Babel](https://babeljs.io/) and [Webpack](https://webpack.js.org/) for transpilation and bundling of JS.

Build JS for debugging: 
````
npm run build:dev
````

Build JS for production: 
````
npm run build
````

Entry point:
````
./src/js/scripts.js
````

Dist:
````
./public/js/bundle.js
````


## Development Workflow

### Branching Strategy
- `main` - Production-ready code
- `dev` - Development branch (auto-deploys via GitHub Actions)
- Feature branches: Create from `main`, merge back to `main` via PR

### Making Changes
1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` (enforced by pre-commit hook)
4. Run `npm test` (enforced by pre-push hook)
5. Create a PR to merge into `main`
6. After review and approval, merge to `main`

### Deployment
Merging to `dev` triggers automatic deployment:
1. GitHub Actions builds Docker image
2. Image pushed to AWS ECR
3. Kubernetes deployment updated in the cluster


## Security

### CSRF Protection
- Implemented using `csrf-csrf` package
- Tokens generated per session and validated on form submissions
- Token passed via hidden form field `_csrf`

### Cookie Security
- `httpOnly` flag prevents JavaScript access
- `secure` flag enabled in production (HTTPS only)
- Session secret from `APP_COOKIE_SECRET` environment variable

### Content Security Policy (CSP)
- Nonce-based CSP for inline scripts
- Nonce available in templates via `cspNonce` variable

### Logging & Redaction
- Sensitive data redacted from logs
- Configure redaction paths via `APP_LOG_REDACT_EXTRA`
- Disable redaction in development with `APP_LOG_REDACT_DISABLE=true`

### Environment Variables
- **Never commit `.env` files** (excluded in `.gitignore`)
- Use environment-specific secrets in production
- Validate required variables on startup (see `ensureEnvVarsAreValid` middleware)

## Biome (linter)
Biome configuration is in the `biome.json` file at the root of the project. Full documentation for the configuration is [here](https://biomejs.dev/reference/configuration/).

### If using VS Code
Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=biomejs.biome). You will find it in the extensions of VS Code.

Update or create your `./vscode/settings.json` with the following:

````json
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
    },
    "[typescript]": {
        "editor.tabSize": 4,
        "editor.defaultFormatter": "biomejs.biome"
    },
    "[css]": {
        "editor.tabSize": 4,
        "editor.defaultFormatter": "biomejs.biome"
    }
}

````


## Husky

### Defined Hooks
| Hook Name  | Action                |
| -          | -                     |
| pre-commit | npm run lint          |
| pre-push   | npm test              |


## Troubleshooting

### OpenSearch Connection Failed
**Error:** Cannot connect to OpenSearch database

**Solutions:**
1. Verify `APP_DATABASE_URL` is correct: `http://localhost:9200`
2. Ensure OpenSearch is running (check airflow setup)
3. Test connection: `curl http://localhost:9200`


### Case Reference Number Required
**Error:** Redirected to `/case` or no search results

**Solution:** Add `caseReferenceNumber` query parameter to URL:
```
http://localhost:5000/search?caseReferenceNumber=25-111111
```


### CSRF Token Errors
**Error:** 403 Forbidden or "Invalid CSRF token"

**Solutions:**
1. Ensure forms include `<input type="hidden" name="_csrf" value="{{ csrfToken }}">`
2. Check session cookie is being set
3. Verify `APP_COOKIE_SECRET` is configured


### Environment Variable Validation Errors
**Error:** Application fails to start with missing environment variable

**Solution:** Check `.env` file contains all required variables (see Installation section)


### Build Errors
**Problem:** CSS or JS not updating

**Solutions:**
1. Rebuild CSS: `npm run sass`
2. Rebuild JS: `npm run build:dev`
3. Check file permissions in `public/` directory


### Debugging
Start app with debugger enabled:
```bash
npm run start:dev
```
Attach debugger to port `9229` in VS Code or Chrome DevTools.


## Accessibility
This application follows [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/) standards.

- Uses GOV.UK Design System components
- Accessibility statement available at `/accessibility-statement`
- Regular accessibility audits recommended


### Testing Accessibility
- Use browser extensions (axe DevTools, WAVE)
- Test with screen readers (NVDA, JAWS)
- Keyboard navigation testing


## Project Structure
```
api/                    - REST API routes and OpenAPI specification
  openapi/              - OpenAPI spec and JSON schemas
  search/               - Search API implementation
bin/                    - Application entry point (www)
components/             - Custom client-side components (Sass, Js, Nunjucks)
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


## Technology Stack
- **Runtime**: Node.js v22.8.0+
- **Framework**: Express.js v5
- **Template Engine**: Nunjucks
- **Search**: OpenSearch
- **CSS**: Sass (SCSS)
- **JavaScript**: Babel + Webpack
- **Linting**: Biome
- **Testing**: Node.js Test Runner
- **Logging**: Pino
- **Security**: csrf-csrf, express-session, cookie-parser
- **Validation**: express-openapi-validator
- **Containerisation**: Docker + Kubernetes
