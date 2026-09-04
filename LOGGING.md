# Logging Breakdown

A complete inventory of everything logged in the FIND (CICA Review Case Documents) system, including log level, structured attributes, and messages.

## Logging Infrastructure

Logging is built on [pino](https://github.com/pinojs/pino) and [pino-http](https://github.com/pinojs/pino-http), configured in `middleware/logger/index.js`.

- **Log format**: Structured JSON (pino). In non-production without an injected stream, output is piped through `pino-pretty` (colorized, single line unless `APP_LOG_PRETTY_JSON=true`).
- **Default level**: `APP_LOG_LEVEL` env var, else `info` in production and `debug` otherwise.
- **Per-request logger**: pino-http attaches a child logger to each request as `req.log`, carrying the request context plus a `correlationId` custom prop (from `x-correlation-id` / `x-request-id` headers, falling back to a generated request id).
- **Redaction**: The following paths are redacted to `[REDACTED]` by default (unless `APP_LOG_REDACT_DISABLE=true`; extra paths can be added via `APP_LOG_REDACT_EXTRA`):
  - `req.headers.authorization`, `req.headers.cookie`, `req.headers["x-api-key"]`
  - `req.query.code`, `req.query.state`, `req.query.id_token`, `req.query.access_token`
  - `req.body.password`, `req.body.username`, `req.body.token`, `req.body._csrf`
  - `res.headers["set-cookie"]`

### Automatic HTTP request logging

pino-http logs every HTTP request/response automatically. The level is derived from the outcome (`customLogLevel`):

| Condition | Level |
|-----------|-------|
| Error thrown or `res.statusCode >= 500` | `error` |
| `res.statusCode >= 400` | `warn` |
| Otherwise (e.g. 2xx/3xx) | `info` |

Each entry also includes `correlationId`.

---

## Application Log Statements

Levels below refer to explicit `logger` / `req.log` calls in the codebase. Note that many logger references use optional chaining (`req.log?.`, `logger?.`), so they only emit when a logger is present.

### Authentication (`auth/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `info` | `Entra silent sign-in requires interaction; retrying with interactive login` | `error`, `entraErrorCode`, `errorUri` | `auth/handlers/callback-handler.js` |
| `warn` | `Entra authorization failed` | `error`, `entraErrorCode`, `errorUri`, `hasState`, `hasMatchingState` | `auth/handlers/callback-handler.js` |
| `warn` | `Invalid Entra callback state` | `hasState`, `hasNonce`, `isStaleAuthTransaction` | `auth/handlers/callback-handler.js` |
| `error` | `Entra token exchange failed` | safe error object (via `safeErrorForLog`) | `auth/handlers/callback-handler.js` |
| `info` | `User authenticated` | `authMethod`, `userId`, `tenantId` | `auth/handlers/callback-handler.js` |
| `error` | `Entra callback handling failed` | safe error object (via `safeErrorForLog`) | `auth/handlers/callback-handler.js` |
| `error` | `Session destruction failed` | safe error object (via `safeErrorForLog`) | `auth/handlers/sign-out-handler.js` |

### Middleware (`middleware/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `error` | `Application Error` | `err` (via `safeErrorForLog`), `status` | `middleware/errors/globalErrorHandler.js` |
| `warn` | `Document validation: <error>` (interpolated) | `documentId` | `middleware/validateDocumentParams/index.js` |
| `warn` | `Page validation: <error>` (interpolated) | `pageNumber` | `middleware/validateDocumentParams/index.js` |
| `warn` | `CRN validation: <error>` (interpolated) | `crn` | `middleware/validateDocumentParams/index.js` |
| `warn` | `Missing session authentication` | `url` | `middleware/isAuthenticated/index.js` |
| `warn` | `INSECURE COOKIE OVERRIDE ENABLED IN PRODUCTION MODE` | `data.environmentVariableName` | `middleware/ensureEnvVarsAreValid/index.js` |
| `debug` | `OPTIONAL ENV VAR NOT SET` | `data.environmentVariableName` | `middleware/ensureEnvVarsAreValid/index.js` |

### Search (`search/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `error` | `Error occurred while processing search request:` | error passed as second arg (not structured) | `search/routes.js` |

### Document viewing — main app (`document/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `info` | `Fetching document page chunks with bounding boxes` | `documentId`, `pageNumber`, `crn`, `searchTerm`, `searchType` | `document/services/document-chunks-service.js` |
| `error` | `Failed to fetch page chunks` | `errors`, `documentId`, `pageNumber` | `document/services/document-chunks-service.js` |
| `info` | `Fetching page metadata` | `documentId`, `pageNumber`, `crn` | `document/services/document-metadata-service.js` |
| `error` | `Failed to retrieve page metadata from API` | `error`, `documentId`, `pageNumber` | `document/utils/metadata/index.js` |
| `error` | `Failed to retrieve page metadata from API` | `error`, `documentId`, `pageNumber` | `document/utils/metadata/fetchPageMetadata.js` |
| `error` | `Failed to retrieve document page chunks` | `error`, `documentId`, `pageNumber`, `searchTerm` | `document/handlers/page-viewer.js` |
| `error` | `Failed to retrieve document page chunks for text highlights` | `error`, `documentId`, `pageNumber`, `searchTerm` | `document/handlers/text-viewer.js` |
| `warn` | `Failed to retrieve page metadata for image streaming` | `error`, `documentId`, `pageNumber`, `crn` | `document/handlers/image-streaming.js` |
| `warn` | `S3 URI not found in metadata for image streaming` | `documentId`, `pageNumber`, `crn` | `document/handlers/image-streaming.js` |
| `info` | `Image not found in S3` | `documentId`, `pageNumber`, `crn` | `document/handlers/image-streaming.js` |
| `warn` | `S3 error when streaming image` | `error`, `documentId`, `pageNumber` | `document/handlers/image-streaming.js` |
| `error` | `Error in image streaming endpoint` | `error` | `document/handlers/image-streaming.js` |

### API (`api/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `error` | `Failed to load OpenAPI spec` | `err` | `api/app.js` |
| `error` | `API Error` | `err` | `api/app.js` |
| `warn` | `Missing authentication token` | `url` | `api/middleware/jwt-authentication/index.js` |
| `error` | `JWT authentication configuration error` | `url`, `error` | `api/middleware/jwt-authentication/index.js` |
| `warn` | `Authentication token is missing a usable identity claim` | `url` | `api/middleware/jwt-authentication/index.js` |
| `warn` | `Invalid authentication token` | `url`, `error` | `api/middleware/jwt-authentication/index.js` |
| `info` | `Retrieving page content` | `documentId`, `pageNumber` | `api/document/services/page-content-service.js` |
| `error` | `Failed to retrieve page content` | `error`, `documentId`, `pageNumber` | `api/document/services/page-content-service.js` |
| `error` | `Failed to retrieve page chunks from OpenSearch` | `error`, `documentId`, `pageNumber`, `searchTerm`, `searchType` | `api/document/services/page-chunks-service.js` |
| `error` | `Failed to retrieve page metadata from OpenSearch` | `error`, `documentId`, `pageNumber` | `api/document/services/page-metadata-service.js` |
| `error` | `Failed to retrieve full page metadata` | `error`, `documentId`, `pageNumber` | `api/document/services/page-metadata-service.js` |

### Data Access Layer / query metrics (`api/DAL/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `debug` | `[QueryBuilder] Query metrics` | `caseReferenceNumber`, `queryHash`, `searchType`, `phraseCount`, `phraseVariantCount`, `shouldClauseCount`, `payloadSize`, `extractMs`, `variantMs`, `buildMs` | `api/DAL/utils/logQueryMetrics/index.js` |
| `warn` | `[QueryBuilder] Variant/clause count exceeds safe threshold` | `caseReferenceNumber`, `queryHash`, `variantCount`, `shouldClauseCount` | `api/DAL/utils/logQueryMetrics/index.js` |

### Database / OpenSearch client (`db/`)

| Level | Message | Attributes | Location |
|-------|---------|------------|----------|
| `debug` | `OpenSearch client created` | `clientType`, `nodeHash` | `db/index.js` |
| `debug` | `OpenSearch client reused` | `clientType`, `nodeHash` | `db/index.js` |
| `info` | `DB QUERY` | `data.query`, `data.rows`, `executionTime`, `executionTimeMs`, `executionTimeNs` | `db/index.js` |
| `warn` | `DB QUERY SLOW` | `index`, `executionTimeMs`, `slowQueryWarnMs`, `rows` | `db/index.js` |

---

## Non-pino / Console Output (not application logging)

These use `console.*` and are build/CLI/hook tooling rather than the runtime pino logger.

| Level | Message | Location | Notes |
|-------|---------|----------|-------|
| `console.error` | `Pre-commit aborted: staged files contain unstaged changes.` (+ follow-up lines and per-file entries) | `scripts/hooks/precommit-staged.js` | Git pre-commit hook script |
| `console.info` | `OpenAPI spec written to <outputPath>` | `api/openapi/buildOpenApiSpec.js` | Build-time CLI status |
| `console.error` | `Error building OpenAPI spec:` | `api/openapi/buildOpenApiSpec.js` | Build-time CLI status |
| `console.error` | `Failed to load OpenAPI spec` (with `{ err }`) | `api/docs/createDocsRouter.js` | Fallback when no request logger |

> Note: `api/app.js` uses `(req.log || console).error(...)` for both `Failed to load OpenAPI spec` and `API Error`, so it falls back to `console.error` when no request logger is available.

---

## Planned / Recommended Additions

> Status: proposed, not yet implemented.

### `userId` — track logs by user

To support filtering logs by user, add a separate `userId` field to the pino-http `customProps` in `middleware/logger/index.js`. This is intended to sit **alongside** `correlationId`, not replace it:

- `correlationId` — traces a single request end to end (and propagates across browser → main app → API via the `x-correlation-id` / `x-request-id` headers). Keep as-is.
- `userId` — identifies the authenticated user so all activity for a user can be filtered, then pivoted to a specific request via `correlationId`.

**Source**: the Entra object id (`oid`) stored on the session as `req.session.entraUser.oid` (set in `auth/handlers/callback-handler.js`).

**Rationale for using `oid`**:
- It is a stable, opaque GUID rather than human-readable PII (preferred over username or email).
- The existing redaction list already treats `req.body.username` as sensitive, so logging a raw username would be inconsistent with the current privacy stance.
- This is CICA case-handling data at the MoJ, so the user identifier is personal data and should be minimised accordingly.

**Behaviour**: the user is not known until after authentication, so `userId` will be absent on pre-auth requests (login, static assets, the callback itself). It should be spread conditionally so the field is omitted rather than logged as `undefined`.

**Proposed change** (`customProps` in `middleware/logger/index.js`):

```javascript
customProps: (req, res) => {
    const correlationId =
        req.headers['x-correlation-id'] || req.headers['x-request-id'] || req.id; // result of genReqId().

    // User is only known after authentication; absent on pre-auth requests.
    const userId = req.session?.entraUser?.oid;

    return {
        correlationId,
        ...(userId ? { userId } : {})
    };
}
```

Once implemented, the automatic HTTP request logging section above should be updated to note that entries also include `userId` on authenticated requests.

### Privacy review — free-text and case-identifying attributes in logs

> Status: open question, needs review.

Some logged attributes are personal or case-identifying data and are **not** currently in the redaction list. This is a privacy consideration rather than a secret-exposure one, but it should be reviewed given this is CICA case-handling data at the MoJ.

- **`searchTerm`** — free text entered by the user. It could contain personal detail (names, injury descriptions, etc.). It is logged as a structured attribute in several places (e.g. `document/services/document-chunks-service.js`, `api/document/services/page-chunks-service.js`, `document/handlers/text-viewer.js`). Note the query-metrics logger already hashes the raw search string (`queryHash`) rather than logging it, which is the safer pattern.
- **`crn`** — the Case Reference Number identifies a specific person's compensation case. It is logged as an attribute in several document/image-streaming log lines.

Points to decide:
- Whether `searchTerm` should be redacted, hashed (as query metrics already do), or omitted from logs.
- Whether `crn` should be logged in full, partially masked, or replaced with a non-identifying reference.
- Whether these should be added to the default redaction paths in `buildRedactConfig` (`middleware/logger/index.js`), noting that redaction there targets `req`/`res` paths, whereas these values are passed as explicit log attributes, so redaction config alone may not cover them.

No change is being made now; this is recorded so the decision is tracked alongside the `userId` proposal.
