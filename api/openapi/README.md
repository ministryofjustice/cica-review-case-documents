# OpenAPI Specification

This directory contains the OpenAPI 3.1 specification for the Case Review Documents API.

## Files

- **`openapi-src.json`** - Source specification file with `$ref` pointers and custom extensions
- **`openapi.json`** - Built specification file used by the application (auto-generated, do not edit directly)
- **`buildOpenApiSpec.js`** - Build script that processes the source spec
- **`json-schemas/`** - JSON Schema definitions referenced by the spec
- **`utils/`** - Utility functions for spec processing

## Making Changes

Always edit `openapi-src.json`, never edit `openapi.json` directly.

After making changes, rebuild the spec:
```bash
npm run build:openapi
```

## Custom Error Messages

This project uses a custom `x-errorMessage` extension to provide user-friendly validation error messages.

### Why `x-errorMessage`?

OpenAPI allows custom extensions prefixed with `x-`. We use `x-errorMessage` in the source spec because:
- It's clearly a custom extension
- It doesn't conflict with standard OpenAPI properties
- It gets transformed to `errorMessage` during the build process
- The error handler reads `errorMessage` from the built spec at runtime

### Usage

Add `x-errorMessage` to parameter schemas with validation constraints:

```json
{
  "components": {
    "parameters": {
      "query": {
        "name": "query",
        "in": "query",
        "required": true,
        "schema": {
          "type": "string",
          "minLength": 2,
          "maxLength": 200,
          "x-errorMessage": {
            "minLength": "Search terms must be 2 characters or more",
            "maxLength": "Search terms must be 200 characters or less"
          }
        }
      }
    }
  }
}
```

### Supported Validation Types

The error handler currently supports custom messages for:

| Validation | Schema Property | Example |
|------------|----------------|---------|
| Minimum Length | `minLength` | `"minLength": "Must be at least 2 characters"` |
| Maximum Length | `maxLength` | `"maxLength": "Must be 200 characters or less"` |
| Pattern | `pattern` | `"pattern": "Must match format XX-XXXXXX"` |

To add support for additional validation types, update:
1. `OPENAPI_VALIDATOR_ERROR_CODES` in `api/middleware/errorHandler/index.js`
2. `OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP` in the same file

### Registering New Parameters

When adding custom error messages for a new parameter:

1. **Add the custom message in `openapi-src.json`:**
   ```json
   {
     "name": "itemsPerPage",
     "schema": {
       "type": "integer",
       "min": 1,
       "max": 100,
       "x-errorMessage": {
         "min": "Must show at least 1 item per page",
         "max": "Cannot show more than 100 items per page"
       }
     }
   }
   ```

2. **Map the parameter in `api/middleware/errorHandler/index.js`:**
   ```javascript
   const QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP = {
       '/params/query': '#/components/parameters/query',
       '/params/itemsPerPage': '#/components/parameters/itemsPerPage'
   };
   ```

3. **Rebuild the spec:**
   ```bash
   npm run build:openapi
   ```

4. **Test the custom messages:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        -H "On-Behalf-Of: 25-111111" \
        "http://localhost:3000/api/search?query=test&itemsPerPage=999"
   ```

### How It Works

1. **Build time:** `buildOpenApiSpec.js` transforms `x-errorMessage` → `errorMessage`
2. **Request time:** express-openapi-validator validates requests against `openapi.json`
3. **Error time:** If validation fails, the error handler extracts custom messages from the spec
4. **Response time:** Users see friendly error messages instead of generic validation errors

### Architecture

```
openapi-src.json (with x-errorMessage)
        ↓
  buildOpenApiSpec.js
        ↓
  transformSchemaProperties (x-errorMessage → errorMessage)
        ↓
openapi.json (with errorMessage)
        ↓
  express-openapi-validator (validates requests)
        ↓
  errorHandler middleware (extracts custom messages)
        ↓
  JSON:API error response (with custom detail)
```

## Build Process

The build script (`buildOpenApiSpec.js`) performs these transformations:

1. **Dereference** - Resolves all `$ref` pointers to their actual schemas
2. **Transform** - Converts `x-errorMessage` to `errorMessage`  
3. **Validate** - Ensures the output is valid OpenAPI 3.1
4. **Output** - Writes to `openapi.json`

This is run automatically as part of:
- `npm run build`
- Pre-deployment scripts
- CI/CD pipelines

## Testing Custom Error Messages

To verify custom error messages work:

```bash
# Too short query (should trigger minLength message)
curl -H "Authorization: Bearer $TOKEN" \
     -H "On-Behalf-Of: 25-111111" \
     "http://localhost:3000/api/search?query=a"

# Expected response:
{
  "errors": [{
    "status": "400",
    "title": "Bad Request",
    "detail": "Search terms must be 2 characters or more"
  }]
}
```

```bash
# Too long query (should trigger maxLength message)
curl -H "Authorization: Bearer $TOKEN" \
     -H "On-Behalf-Of: 25-111111" \
     "http://localhost:3000/api/search?query=$(python3 -c 'print("a"*201)')"

# Expected response:
{
  "errors": [{
    "status": "400",
    "title": "Bad Request",
    "detail": "Search terms must be 200 characters or less"
  }]
}
```

## Extending Validation Support

To add support for new validation types (e.g., `minimum`, `maximum`, `enum`):

1. **Add the error code constant:**
   ```javascript
   // In api/middleware/errorHandler/index.js
   const OPENAPI_VALIDATOR_ERROR_CODES = {
       MIN_LENGTH: 'minLength.openapi.validation',
       MAX_LENGTH: 'maxLength.openapi.validation',
       PATTERN: 'pattern.openapi.validation',
       MINIMUM: 'minimum.openapi.validation',  // Add this
       MAXIMUM: 'maximum.openapi.validation'   // Add this
   };
   ```

2. **Map it to the schema property:**
   ```javascript
   const OPENAPI_ERRORS_SCHEMA_PROPERTY_ERRORS_MAP = {
       [OPENAPI_VALIDATOR_ERROR_CODES.MIN_LENGTH]: 'minLength',
       [OPENAPI_VALIDATOR_ERROR_CODES.MAX_LENGTH]: 'maxLength',
       [OPENAPI_VALIDATOR_ERROR_CODES.PATTERN]: 'pattern',
       [OPENAPI_VALIDATOR_ERROR_CODES.MINIMUM]: 'minimum',  // Add this
       [OPENAPI_VALIDATOR_ERROR_CODES.MAXIMUM]: 'maximum'   // Add this
   };
   ```

3. **Use it in your spec:**
   ```json
   {
     "schema": {
       "type": "integer",
       "minimum": 1,
       "maximum": 100,
       "x-errorMessage": {
         "minimum": "Value must be at least 1",
         "maximum": "Value cannot exceed 100"
       }
     }
   }
   ```

## Troubleshooting

### Custom messages not appearing

1. Verify `x-errorMessage` is in `openapi-src.json` (not `openapi.json`)
2. Check the parameter is mapped in `QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP`
3. Ensure you ran `npm run build:openapi` after making changes
4. Restart the application to load the new spec
5. Check error handler logs for any resolution issues

### Wrong validation type

Make sure the error code in `OPENAPI_VALIDATOR_ERROR_CODES` matches the express-openapi-validator error code exactly. Check the validator's error object in the logs.

### Parameter not found in spec

The JSON Pointer path in `QUERY_PARAM_OPENAPI_PATH_PARAMETER_MAP` must exactly match the structure in `openapi.json`. Use the format: `#/components/parameters/{parameterName}`
