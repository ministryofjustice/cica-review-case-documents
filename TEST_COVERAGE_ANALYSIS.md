# Test Coverage Analysis Report

## Overview
This report identifies missing test coverage for 5 files based on uncovered lines from branch coverage analysis.

---

## 1. File: api/app.js
**Current Branch Coverage:** 70%  
**Uncovered Lines:** 48-50, 72

### Uncovered Code Analysis

#### Lines 48-50 (Error handling in OpenAPI spec loading):
```javascript
try {
    openApiSpec = JSON.parse(await readFile(openApiPath, 'utf-8'));
} catch (err) {
    // Use the app's logger instance if available
    (app.get('logger') || console).error({ err }, 'Failed to load OpenAPI spec');
}
```

**What's not tested:**
- The `catch` block (line 48-50) is never triggered in tests
- The error handling path when OpenAPI spec file fails to load/parse
- The fallback error logging behavior - the condition `(app.get('logger') || console).error` 
- Specifically: when `app.get('logger')` returns a logger vs. when it's falsy and console is used

**Missing Test Cases:**
1. **Test: "handles missing OpenAPI spec file gracefully"**
   - Provide an invalid/non-existent `openApiPath` in options
   - Verify the app initializes without throwing an error
   - Verify error is logged (either via app logger or console)
   - Expected: App should continue to function, endpoint creation should proceed

2. **Test: "handles malformed OpenAPI spec JSON gracefully"**
   - Mock readFile to return invalid JSON
   - Verify catch block executes and error is logged
   - Verify app still initializes

3. **Test: "uses app logger if available for OpenAPI spec errors"**
   - Pass a mock logger in options
   - Set app.get('logger') to return the logger
   - Verify logger.error is called (not console.error)

4. **Test: "falls back to console.error when app logger is unavailable"**
   - Ensure app.get('logger') returns null/undefined
   - Verify console.error is called with error details

#### Line 72 (Non-production docs router):
```javascript
if (process.env.DEPLOY_ENV !== 'production') {
    docsRouter.use(
        '/',
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    'script-src': ["'self'", "'unsafe-inline'"],
                    'style-src': ["'self'", "'unsafe-inline'"]
                }
            }
        }),
        swaggerUi.serve,
        swaggerUi.setup(openApiSpec)
    );
}
```

**What's not tested:**
- The condition when `DEPLOY_ENV === 'production'` - the block never executes
- The entire helmet + swagger middleware chain is skipped in production

**Missing Test Cases:**
5. **Test: "disables Swagger UI in production environment"**
   - Set `DEPLOY_ENV=production`
   - Make request to `/docs/`
   - Should still receive 401 (authentication required) or similar, but not have swagger-ui rendered
   - Verify helmet, swaggerUi.serve, and swaggerUi.setup are NOT attached

6. **Test: "enables Swagger UI in non-production environments"**
   - Set `DEPLOY_ENV=development` (or any value !== 'production')
   - Authenticate with valid JWT
   - Request `/docs/`
   - Verify helmet CSP headers are present
   - Verify swagger-ui content is served

---

## 2. File: middleware/rateLimiter/index.js
**Current Branch Coverage:** 66.66%  
**Uncovered Lines:** 30-33, 37-38

### Uncovered Code Analysis

#### Lines 30-33 (Key generation logic - session ID preference):
```javascript
keyGenerator: (req) =>
    req.session?.loggedIn && req.session?.id
        ? req.session.id
        : req.user?.id
```

**What's not tested:**
- The condition `req.session?.loggedIn && req.session?.id` evaluating to true
- When session exists with both `loggedIn=true` and `id` set, should use `req.session.id` as the key
- The ternary operator's true branch

#### Lines 37-38 (Key generation logic - user.id fallback):
```javascript
        ? req.user.id
              : ipKeyGenerator(req)
```

**What's not tested:**
- When `req.user?.id` exists but session doesn't - should use `req.user.id`
- When neither session nor user exist - should fall back to IP-based key generation via `ipKeyGenerator(req)`

**Missing Test Cases:**

1. **Test: "uses session ID as rate limit key when session is logged in"**
   - Create request with `req.session = { loggedIn: true, id: 'session-123' }`
   - Verify rate limiter uses 'session-123' as the key
   - Multiple requests with same session should increment same counter

2. **Test: "uses user ID when session is not available"**
   - Create request with `req.user = { id: 'user-456' }` but no session
   - Verify rate limiter uses 'user-456' as the key
   - Multiple requests with same user should increment same counter

3. **Test: "uses IP address as fallback when neither session nor user exists"**
   - Create request with no session and no user
   - Verify `ipKeyGenerator` is called
   - Verify rate limiter uses IP-based key
   - Multiple requests from same IP should increment same counter

4. **Test: "prioritizes session ID over user ID"**
   - Create request with both `req.session = { loggedIn: true, id: 'session-123' }` AND `req.user = { id: 'user-456' }`
   - Verify rate limiter uses 'session-123' (not 'user-456')
   - Confirm session takes priority in ternary evaluation

5. **Test: "ignores session ID if loggedIn is false"**
   - Create request with `req.session = { loggedIn: false, id: 'session-123' }`
   - Verify rate limiter falls through to check `req.user.id` (not 'session-123')

6. **Test: "ignores session ID if session.id is missing"**
   - Create request with `req.session = { loggedIn: true }` (id is undefined)
   - Verify short-circuit evaluation skips session and moves to user check

---

## 3. File: document/services/s3-service.js
**Current Branch Coverage:** 42.85%  
**Uncovered Lines:** 14-15, 31, 46-49

### Uncovered Code Analysis

#### Lines 14-15 (Local S3 endpoint detection):
```javascript
const isLocal = S3_BUCKET_LOCATION.includes('localhost');

return new S3Client({
    region: AWS_REGION,
    ...(isLocal
```

**What's not tested:**
- The condition when `S3_BUCKET_LOCATION.includes('localhost')` returns FALSE
- When S3 bucket is in AWS (production), the `isLocal` branch that sets endpoint/credentials

#### Line 31 (AWS production branch):
```javascript
            : {
                  // In AWS, use IRSA: do not set endpoint or credentials
              })
```

**What's not tested:**
- The entire else branch (lines 26-31) - when `isLocal === false`
- S3Client initialization with AWS defaults (no endpoint, no credentials)
- This is the production AWS branch using IRSA (IAM Roles for Service Accounts)

#### Lines 46-49 (Error validation in validateS3Config):
```javascript
if (!API_BASE_URL || !S3_BUCKET_LOCATION) {
    throw new Error(
        'Missing required environment variables APP_API_URL and/or APP_S3_BUCKET_LOCATION'
    );
}
```

**What's not tested:**
- When `API_BASE_URL` is missing but `S3_BUCKET_LOCATION` is set
- When `S3_BUCKET_LOCATION` is missing but `API_BASE_URL` is set  
- When BOTH are missing
- The combined condition `!API_BASE_URL || !S3_BUCKET_LOCATION`

**Missing Test Cases:**

1. **Test: "createS3Client creates local S3 client when bucket location contains 'localhost'"**
   - Set `APP_S3_BUCKET_LOCATION='http://localhost:9000'`
   - Call `createS3Client()`
   - Verify returned S3Client has:
     - `endpoint: 'http://localhost:9000'`
     - `forcePathStyle: true`
     - credentials with `accessKeyId` and `secretAccessKey`
   - Verify `region` is still set

2. **Test: "createS3Client creates AWS S3 client when bucket location is production URL"**
   - Set `APP_S3_BUCKET_LOCATION='s3.eu-west-2.amazonaws.com'`
   - Call `createS3Client()`
   - Verify returned S3Client has:
     - NO `endpoint` property (or undefined)
     - NO credentials in config
     - `region: AWS_REGION` is set
   - Verify it's configured for IRSA authentication

3. **Test: "createS3Client uses AWS_REGION environment variable"**
   - Set `AWS_REGION='eu-west-1'`
   - Call `createS3Client()`
   - Verify S3Client created with `region: 'eu-west-1'`

4. **Test: "createS3Client defaults to 'eu-west-2' when AWS_REGION not set"**
   - Unset `AWS_REGION`
   - Call `createS3Client()`
   - Verify S3Client created with `region: 'eu-west-2'` (default)

5. **Test: "createS3Client throws error when APP_S3_BUCKET_LOCATION is missing"**
   - Unset `APP_S3_BUCKET_LOCATION`
   - Call `createS3Client()`
   - Expect Error: 'Missing required environment variable APP_S3_BUCKET_LOCATION'

6. **Test: "validateS3Config throws when APP_API_URL is missing"**
   - Unset `APP_API_URL`, set `APP_S3_BUCKET_LOCATION='http://s3'`
   - Call `validateS3Config()`
   - Expect error containing 'APP_API_URL'

7. **Test: "validateS3Config throws when APP_S3_BUCKET_LOCATION is missing"**
   - Set `APP_API_URL='http://api'`, unset `APP_S3_BUCKET_LOCATION`
   - Call `validateS3Config()`
   - Expect error containing 'APP_S3_BUCKET_LOCATION'

8. **Test: "validateS3Config throws when both variables are missing"**
   - Unset both `APP_API_URL` and `APP_S3_BUCKET_LOCATION`
   - Call `validateS3Config()`
   - Expect error mentioning both variables

9. **Test: "validateS3Config passes when both required variables are set"**
   - Set `APP_API_URL='http://api.example.com'`
   - Set `APP_S3_BUCKET_LOCATION='http://s3.example.com'`
   - Call `validateS3Config()`
   - Should NOT throw any error

10. **Test: "createS3Client uses test credentials for local development"**
    - Set `APP_S3_BUCKET_LOCATION='http://localhost:9000'`
    - Unset `CICA_AWS_ACCESS_KEY_ID` and `CICA_AWS_SECRET_ACCESS_KEY`
    - Call `createS3Client()`
    - Verify credentials default to `accessKeyId: 'test'` and `secretAccessKey: 'test'`

---

## 4. File: api/middleware/validator/index.js
**Current Branch Coverage:** 75%  
**Uncovered Lines:** 24-25

### Uncovered Code Analysis

#### Lines 24-25 (File existence check):
```javascript
if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI spec file not found at: ${openApiPath}`);
}
```

**What's not tested:**
- The condition when `fs.existsSync(openApiPath)` returns FALSE
- The error path when OpenAPI spec file doesn't exist
- The specific error message format

**Missing Test Cases:**

1. **Test: "throws error when OpenAPI spec file not found"**
   - Pass `apiSpecPath` pointing to non-existent file
   - Call `createOpenApiValidatorMiddleware({ ajv, logger, apiSpecPath })`
   - Expect promise to reject with Error
   - Verify error message contains the path

2. **Test: "throws error with correct message format"**
   - Pass invalid path like `/invalid/path/openapi.json`
   - Catch the thrown error
   - Verify error message: `'OpenAPI spec file not found at: /invalid/path/openapi.json'`

3. **Test: "succeeds when OpenAPI spec file exists"**
   - Use valid path to existing spec file (e.g., the actual `openapi-dist.json`)
   - Call `createOpenApiValidatorMiddleware({ ajv, logger, apiSpecPath })`
   - Verify promise resolves to a function (middleware)
   - Verify no error is thrown

---

## 5. File: document/handlers/text-viewer.js
**Current Branch Coverage:** 75%  
**Uncovered Lines:** 43-44

### Uncovered Code Analysis

#### Lines 43-44 (Error handling in try-catch):
```javascript
        } catch (err) {
            next(err);
        }
```

**What's not tested:**
- The catch block that handles errors in the text viewer handler
- When an exception occurs during template rendering or link building
- The error is passed to Express error middleware via `next(err)`

**Missing Test Cases:**

1. **Test: "handles template rendering errors"**
   - Mock `createTemplateEngineService()` to return a render function that throws
   - Make request to text viewer endpoint
   - Verify `next(err)` is called with the error
   - Verify error handling middleware receives the error
   - Expected: Express error handler processes the error (500 response or similar)

2. **Test: "handles buildImagePageLink errors"**
   - Mock `buildImagePageLink` to throw an error
   - Make request to text viewer endpoint
   - Verify error is caught and passed to error middleware

3. **Test: "handles buildBackLink errors"**
   - Mock `buildBackLink` to throw an error
   - Make request to text viewer endpoint
   - Verify error is caught and passed to error middleware

4. **Test: "catches and forwards arbitrary errors in handler"**
   - Simulate a missing required value or null reference
   - Make request that triggers an error within the try block
   - Verify `next(err)` is invoked (error reaches error handler)
   - Verify HTTP response shows error was handled (no unhandled rejection)

5. **Test: "error handler receives error object with context"**
   - Make request that causes an error in the handler
   - Verify the error passed to error middleware contains:
     - Error message/stack
     - Request context (headers, path, etc.)
     - Proper HTTP status code in response

---

## Summary Table

| File | Current Coverage | Uncovered Lines | # Missing Tests | Priority |
|------|------------------|-----------------|-----------------|----------|
| api/app.js | 70% | 48-50, 72 | 6 | High |
| middleware/rateLimiter/index.js | 66.66% | 30-33, 37-38 | 6 | High |
| document/services/s3-service.js | 42.85% | 14-15, 31, 46-49 | 10 | Critical |
| api/middleware/validator/index.js | 75% | 24-25 | 3 | Medium |
| document/handlers/text-viewer.js | 75% | 43-44 | 5 | Medium |

**Total Missing Tests: 30**

### Recommendations

1. **Start with `s3-service.js`** - Lowest coverage (42.85%) with 10 missing test cases. This module handles critical AWS infrastructure configuration.

2. **Focus on error paths** - Most uncovered lines are in error handling or conditional branches that don't trigger in happy-path tests.

3. **Environment-dependent tests** - Several files have branches based on environment variables (`DEPLOY_ENV`, `NODE_ENV`, `APP_S3_BUCKET_LOCATION`). Use `beforeEach`/`afterEach` to set and restore env vars.

4. **Mock third-party modules** - For tests involving file system, AWS SDK, and template engines, use mocks/stubs to control behavior.

5. **Test conditional logic thoroughly** - The ternary operators and boolean conditions are prime candidates for incomplete coverage. Use both true and false branches explicitly.
