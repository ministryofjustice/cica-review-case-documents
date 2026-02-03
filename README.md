# FIND

[![Ministry of Justice Repository Compliance Badge](https://github-community.service.justice.gov.uk/repository-standards/api/cica-review-case-documents-airflow/badge)](https://github-community.service.justice.gov.uk/repository-standards/cica-review-case-documents-airflow)


[![GitHub repo size](https://img.shields.io/github/repo-size/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents)
[![GitHub repo npm version](https://img.shields.io/badge/npm_version->=10.8.2-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L5)
[![GitHub repo node version](https://img.shields.io/badge/node_version->=22.8.0-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L6)
[![GitHub repo contributors](https://img.shields.io/github/contributors/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/graphs/contributors)
[![GitHub repo license](https://img.shields.io/github/package-json/license/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/LICENSE)


A web application for searching and reviewing case documents for the Criminal Injuries Compensation Authority (CICA).

> [!NOTE]
> To set up the OpenSearch database and client, please refer to the [airflow documentation](https://github.com/ministryofjustice/cica-review-case-documents-airflow?tab=readme-ov-file#cica-review-case-documents-airflow-ingestion-pipeline).

## Prerequisites

- [OpenSearch setup](https://github.com/ministryofjustice/cica-review-case-documents-airflow) - Follow the airflow documentation
- 
  Or alternatively use Port forwarding to the dev or uat environments Opensearch instance.
  Connect to the environment using kubectl see [Connecting to the Cloud Platform’s Kubernetes cluster](https://user-guide.cloud-platform.service.justice.gov.uk/documentation/getting-started/kubectl-config.html#generating-a-kubeconfig-file)

  run, environments: [dev, uat]
  ```
  kubectl  -n cica-review-case-documents-{environment} get pods
  ```
  select the opensearch proxy service url and run 

  ```
   kubectl port-forward service/opensearch-proxy-service-{url} 9200:8080 --namespace cica-review-case-documents-{environment}
  ```

  You should see something similar to
  ```
  Forwarding from 127.0.0.1:9200 -> 8080
  ```
  You can then run the app with 

- Node.js [See required node version in package.json](https://github.com/ministryofjustice/cica-review-case-documents/blob/main/package.json#L6)
- npm [See required npm version in package.json](https://github.com/ministryofjustice/cica-review-case-documents/blob/main/package.json#L5)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

See [`.env.example`](./.env.example) for all available configuration options and descriptions.

### 3. Build OpenAPI Specification

```bash
# Build the OpenAPI specification
npm run openapi:build
```

This generates the API documentation (`api/openapi/openapi-dist.json`). The OpenAPI spec must be manually rebuilt when making changes to the API schema or endpoints.

### 4. Run the Application

```bash
# Development mode (with auto-reload and debugger)
npm run start:dev

# Production mode
npm start
```

Navigate to `http://localhost:5000/` in your browser.


## Available Scripts

For a complete list of available npm scripts, see the `scripts` section in [`package.json`](./package.json).

**Common commands:**

| Script | Description |
| - | - |
| `npm start` | Start the app in production mode |
| `npm run start:dev` | Start with auto-reload and debugger on port 9229 |
| `npm test` | Run all tests |
| `npm run lint` | Check code with Biome linter |
| `npm run format` | Format code with Biome |
| `npm run sass` | Compile Sass to CSS |
| `npm run build` | Build production JavaScript |
| `npm run build:dev` | Build development JavaScript with source maps |


## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --env-file=.env.test --test search/routes.test.js
```

For detailed testing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md#testing).

This web app is intended to be accessed via Tempus. Tempus has specific links that a user can click on to get to specific areas of this web app.

## Usage

### Internal Redirect Allowlist and Patterns

This application uses a strict allowlist and pattern-based approach to control which internal URLs can be used for redirects (e.g., when enforcing the presence of a `crn` query parameter). This is a key security measure to prevent open redirect vulnerabilities and ensure only safe, intended routes are eligible for internal redirection.

- **Static allowlist:** Only explicitly listed static paths (e.g., `/search`) are eligible for redirects.
- **Pattern allowlist:** Dynamic routes (such as document viewing pages) are matched using strict regular expressions (e.g., `/document/<UUID>/view/image/page/<pageNumber>`), ensuring only valid, expected paths are allowed.
- **Hardening:** Additional checks block suspicious or malformed paths (e.g., those containing `//`, `..`, protocol strings, or backslashes).

**If you add a new route that should support internal redirects:**
- Update the allowlist or pattern list in `middleware/enforceCrnInQuery/index.js`.
- Add or update tests in `middleware/enforceCrnInQuery/allowList.test.js` to cover the new route or pattern.
- See [CONTRIBUTING.md](./CONTRIBUTING.md#internal-redirect-allowlist) for more details.

### Login and authentication

A temporary login feature has been implemented (rather quickly) until the Microsoft Entra ID SSO is implemented.
Add authention settings to your .env file from the [`.env.example`](./.env.example) template.


### Case Reference Number Selection

In order to search, users must first select which case they are searching. This is done with a query parameter in the URL:

| Parameter | Description |
| - | - |
| caseReferenceNumber | The case that will be searched |
| crn | Alias of `caseReferenceNumber` |

**Examples:**

```
http://localhost:5000/search?caseReferenceNumber=25-111111
```
Selects case with CRN `25-111111`. The UI will display `CRN: 25-111111` and enable searching within documents for that case.

```
http://localhost:5000/search?query=Gabapentin&crn=25-111111
```
Same as above, but also performs a search.

```
http://localhost:5000/search/?query=Acute&pageNumber=2&crn=25-111111
```
Pagination example

http://localhost:5000/search/the?caseReferenceNumber=12-121212
```
This CRN does not exist, so no results will be returned.

### Search URL Format

**GET** `/search?query={query}&pageNumber={pageNumber}&crn={customerReferenceNumber}`

| Parameter | Description |
| - | - |
| query | Space-delimited keywords or sentence to search for |
| pageNumber | Page number of the paginated results |
| itemsPerPage | The number of items to show per page of results |

## API Documentation

The API is documented using OpenAPI 3.1 specification. See [`api/openapi/openapi.json`](./api/openapi/openapi.json) for the complete API documentation including:

- Available endpoints
- Request/response schemas
- Authentication requirements
- Parameter descriptions
- Example requests and responses

### Accessing API Documentation

The interactive Swagger UI is available at `/api-docs` when the application is running:

```
http://localhost:5000/api-docs
```

**Note:** The OpenAPI specification must be built before accessing the documentation. Run `npm run openapi:build` if you encounter errors.

**Quick API reference:**

**GET** `/api/search?query={query}&pageNumber={pageNumber}&crn={customerReferenceNumber}&itemsPerPage={itemsPerPage}`

Searches for text in documents within a specific case.

**Headers:**
- `On-Behalf-Of` (required): Case reference number (e.g., `25-111111`)

**Example:**
```bash
curl -H "On-Behalf-Of: 25-111111" \
  http://localhost:5000/api/search/gabapentin/1/10
```


## Building Assets

### CSS

```bash
npm run sass
```

Compiles `./src/sass/all.scss` → `./public/stylesheets/all.css`

### JavaScript

```bash
# Development (with source maps)
npm run build:dev

# Production (minified)
npm run build
```

Compiles `./src/js/scripts.js` → `./public/js/bundle.js`

For more details on build processes, see [CONTRIBUTING.md](./CONTRIBUTING.md#building-assets).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed information on:

- Development workflow and branching strategy
- Code quality standards and linting
- Security best practices
- Testing guidelines
- Project structure
- Technology stack
- Troubleshooting common issues
- Accessibility guidelines

## License

[MIT](./LICENSE)
