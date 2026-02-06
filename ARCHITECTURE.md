# Architecture and Functional Specification

## System Overview

The CICA Review Case Documents application is a document viewing system designed with a clear separation of concerns between the browser client, main application server, API server, and data stores (OpenSearch and S3).

## Architecture Principles

### Three-Tier Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────┐
│  Main App   │ (Express.js on port 5000)
│  /document  │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌─────────────┐
│  API Server │  │  AWS S3 /   │
│  /api       │  │ LocalStack  │
└──────┬──────┘  └─────────────┘
       │
       ▼
┌─────────────┐
│ OpenSearch  │
└─────────────┘
```

### Key Design Decisions

1. **Browser Never Talks Directly to API or S3**
   - All browser requests go through the main application
   - The main application acts as a gateway/orchestrator
   - This provides better security, request validation, and session management

2. **Main App Routes Requests Based on Data Type**
   - **Metadata (from OpenSearch)**: Main app → API → OpenSearch
   - **Images (from S3)**: Main app → S3 directly
   - The main app never queries OpenSearch directly

3. **API is Data-Focused**
   - API only handles data operations (search, metadata, chunk retrieval)
   - API queries OpenSearch for all document and page metadata
   - API does not stream binary content (images)

## Component Responsibilities

### Browser
- Initiates all user requests
- Displays rendered HTML pages
- Loads images via main app URLs
- **Never communicates directly with API or S3**

### Main Application (`/document` routes)
**Purpose**: Gateway and orchestration layer

**Responsibilities**:
- Render HTML pages with document viewers
- Stream binary image data from S3 to browser
- Fetch metadata from API (which queries OpenSearch)
- Manage user sessions and authentication
- Apply middleware (CSRF, auth, rate limiting)

**Routes**:
- `GET /document/:documentId/view/page/:pageNumber` - Renders HTML page with image viewer
  - Query Parameters: `crn` (required), `searchTerm` (optional), `searchResultsPageNumber` (optional)
  - Search context parameters persist through navigation to allow users to return to search results
- `GET /document/:documentId/page/:pageNumber` - Streams image binary from S3
  - Query Parameters: `crn` (required)
- `GET /document/:documentId/view/text/page/:pageNumber` - Renders text view page
  - Query Parameters: `crn` (required), `searchTerm` (optional), `searchResultsPageNumber` (optional)

**Dependencies**:
- Calls API at `${APP_API_URL}/document/:documentId/page/:pageNumber/metadata` for OpenSearch data
- Streams from S3 using `@aws-sdk/client-s3`

### API Server (`/api` routes)
**Purpose**: Data access layer for OpenSearch

**Responsibilities**:
- Query OpenSearch for document metadata
- Query OpenSearch for page metadata (correspondence_type, dimensions, S3 URIs)
- Query OpenSearch for page chunks relating to a specific document
- Execute search queries
- Return JSON responses only (no HTML rendering, no binary streaming)

**Routes**:
- `GET /api/search?query=...` - Search document chunks
- `GET /api/document/:documentId/page/:pageNumber/metadata?crn=...` - Get page metadata from OpenSearch
- `GET /api/document/:documentId/page/:pageNumber/chunks?crn=...` - Get document page chunks

**Dependencies**:
- Direct connection to OpenSearch via `db/index.js`
- Uses DAL (Data Access Layer) at `api/DAL/document-dal.js`

### Data Stores

#### OpenSearch
- Stores document and page metadata
- Indexed fields: `correspondence_type`, `page_num`, `source_doc_id`, `s3_page_image_s3_uri`, etc.
- Two indexes: `chunks` (for search), `page_metadata` (for page details)

#### AWS S3 / LocalStack
- Stores actual document page images (PNG format)
- URI format: `s3://document-page-bucket/123/{documentId}/pages/{pageNum}.png`
- Accessed directly by main app (not via API)

## Request Flow Examples

### Search Context Preservation

When a user searches for documents and clicks on a result, the application preserves the search context through query string parameters:

- **`searchTerm`**: The original search query text
- **`searchResultsPageNumber`**: The page number in search results where the user clicked

These parameters are:
1. Passed from search results to document pages
2. Used to construct back links that return users to their original search results page
3. Passed through navigation between image and text views

This ensures users can seamlessly navigate from search results → document → back to search results without losing their place.

## Request Flow Examples

### Example 1: User Views Document Page (from Search Results)

1. **Browser → Main App**
   ```
   GET /document/abc-123/view/page/1?crn=123&searchTerm=additional+info&searchResultsPageNumber=2
   ```
   
   Note: Search context (`searchTerm`, `searchResultsPageNumber`) is passed to maintain navigation context

2. **Main App → API** (fetch metadata)
   ```
   GET http://localhost:5000/api/document/abc-123/page/1/metadata?crn=123
   ```
   
   **API Response**:
   ```json
   {
     "data": {
       "correspondence_type": "TC19 - ADDITIONAL INFO REQUEST",
       "imageUrl": "s3://document-page-bucket/123/abc-123/pages/1.png",
       "page_width": 1654,
       "page_height": 2339,
       "page_count": 5
     }
   }
   ```

3. **Main App → Browser** (render HTML with search context preserved)
   ```html
   <html>
     <h1>TC19 - ADDITIONAL INFO REQUEST</h1>
     <img src="/document/abc-123/page/1?crn=123" />
     <a href="/search?query=additional+info&pageNumber=2&crn=123">Back to results</a>
     <a href="/document/abc-123/view/text/page/1?crn=123&searchTerm=additional+info&searchResultsPageNumber=2">View text</a>
   </html>
   ```

4. **Browser → Main App** (load image)
   ```
   GET /document/abc-123/page/1?crn=123
   ```

5. **Main App → S3** (stream image directly using known S3 path pattern)
   ```
   GetObjectCommand({
     Bucket: "document-page-bucket",
     Key: "123/abc-123/pages/1.png"
   })
   ```
   
   Note: The main app constructs the S3 path directly without calling the API.
   Pattern: `{bucket}/{crn}/{documentId}/pages/{pageNumber}.png`

6. **Main App → Browser** (stream binary)
   ```
   Content-Type: image/png
   [binary PNG data]
   ```

### Example 2: User Searches Documents

1. **Browser → Main App**
   ```
   GET /search?query=additional+info&crn=123
   ```

2. **Main App → API**
   ```
   GET http://localhost:5000/api/search?query=additional+info&crn=123
   ```

3. **API → OpenSearch**
   ```json
   POST /chunks/_search
   {
     "query": { "match": { "text": "additional info" } }
   }
   ```

4. **API → Main App** (JSON results)
   ```json
   {
     "data": [
       { "documentId": "abc-123", "pageNumber": 1, "snippet": "..." }
     ]
   }
   ```

5. **Main App → Browser** (rendered HTML)
   ```html
   <ul>
     <li><a href="/document/abc-123/view/page/1">Document abc-123, Page 1</a></li>
   </ul>
   ```

## Environment Configuration

### Main Application
- `APP_API_URL` - URL to API server (e.g., `http://localhost:5000/api`)
- `AWS_REGION` - AWS region (e.g., `eu-west-2`)
- `AWS_ACCESS_KEY_ID` - AWS credentials (use `000000000000` for LocalStack)
- `AWS_SECRET_ACCESS_KEY` - AWS secret (use `test` for LocalStack)

### API Server
- `OPENSEARCH_INDEX_CHUNKS_NAME` - OpenSearch chunks index name
- `OPENSEARCH_URL` - OpenSearch connection URL

### S3 Client Setup and Environment-Specific Configuration

- **Local Development:**  
  - Uses LocalStack for S3 emulation.  
  - S3 client is configured with `endpoint` set to `http://localhost:4566`, `forcePathStyle: true`, and dummy credentials (`CICA_AWS_ACCESS_KEY_ID`, `CICA_AWS_SECRET_ACCESS_KEY`).
  - Example:
    ```
    endpoint: http://localhost:4566
    forcePathStyle: true
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
    ```

- **DEV/Production (AWS):**  
  - S3 client uses default AWS SDK configuration.
  - Credentials are provided via IRSA (IAM Roles for Service Accounts) in Kubernetes; do not set `endpoint` or static credentials.
  - The application pod must be annotated with the correct IAM role for S3 access.
  - Example:
    ```
    // No endpoint or credentials set; uses IRSA
    ```

- **Multiple AWS Accounts:**  
  - S3 and Bedrock may reside in different AWS accounts.
  - Use environment variables with clear prefixes (e.g., `CICA_AWS_ACCESS_KEY_ID`) to avoid confusion.
  - Ensure cross-account permissions are set up for IRSA roles.

## Technology Stack

### Backend
- **Node.js** with **Express.js** framework
- **AWS SDK v3** (`@aws-sdk/client-s3`) for S3 operations
- **OpenSearch** for document indexing and search
- **Nunjucks** template engine for HTML rendering

### Development Tools
- **LocalStack** for local S3 testing
- **Docker** for containerization
- **Jest** for testing

## Security Considerations

1. **No Direct API Access from Browser**
   - API is not exposed to public internet
   - Main app validates all requests before forwarding

2. **Session Management**
   - Main app maintains user sessions
   - Case reference number (CRN) required for all document access

3. **CSRF Protection**
   - CSRF tokens validated on all state-changing requests

4. **Rate Limiting**
   - Applied at main app level before reaching API

## Error Handling

### Image Not Found (S3)
- Main app returns HTTP 204 (No Content)
- Browser displays "image not available" message
- Does not cascade to 500 errors

### Metadata Not Found (OpenSearch)
- API returns HTTP 404 with JSON error
- Main app passes error to error handler middleware
- User sees appropriate error page

### API Unavailable
- Main app catches fetch errors
- Logs error with request details
- Returns 500 error to user with retry option

## Testing Strategy

### Unit Tests
- Test each route handler in isolation
- Mock API calls and S3 operations
- Verify error handling paths

### Integration Tests
- Test main app → API communication
- Test main app → S3 streaming
- Verify request/response formats

### End-to-End Tests
- Full browser → main app → API → OpenSearch flow
- Image streaming from LocalStack S3
- Search and navigation workflows

## Future Considerations

1. **Caching Layer**
   - Consider Redis for API response caching
   - Cache page metadata to reduce OpenSearch queries

2. **CDN for Images**
   - CloudFront in front of S3 for production
   - Reduce main app streaming load

3. **API Rate Limiting**
   - Add rate limiting to API endpoints
   - Prevent abuse of metadata endpoints

4. **API Versioning**
   - Version API endpoints (`/api/v1/...`)
   - Support backward compatibility

## Maintenance Notes

### When Adding New Features

1. **New OpenSearch Query**: Add to API, not main app
2. **New Image Source**: Stream through main app, not API
3. **New Page Type**: Update both main app routes and API metadata endpoint

### When Debugging

1. **Image Not Loading**: Check S3 configuration in main app, not API
2. **Wrong Page Title**: Check API metadata endpoint, not main app
3. **Search Not Working**: Check API search endpoint and OpenSearch connection

## Document History

- **2026-01-23**: Initial architecture specification
  - Defined three-tier architecture
  - Documented separation of concerns: Browser → Main App → API/S3
  - Established rule: OpenSearch queries only through API
