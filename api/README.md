# API Structure
A quick overview of the file layout in the api/ folder.

The API is split into two parts:
1) A general search across documents `/search`
2) Retrieving data for a specific document `/document`

## Search
Search allows a general search across multiple documents associated with a Case Reference Number (CRN). It uses the shared Data Access Layer (DAL) to query data from OpenSearch matching a searchTerm.

## Document
The document routes and services allow the system to return related data from the shared DAL when a document and page have been selected. Whilst there is overlap in some sense with the search feature, the calls being by document-id is enough to define this as a separate part of the API. Extending the search service to cover the additional functionality would not adhere to separation of concerns and adds unnecessary complexity.

## Guidelines
When extending the functionality of either endpoint, keep related files within the appropriate folder structures:
- Routes and route tests stay in their respective folders (`/document`, `/search`)
- Shared utilities like DAL are placed at the `api/` level

