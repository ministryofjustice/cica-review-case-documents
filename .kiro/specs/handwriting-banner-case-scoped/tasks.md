# Implementation Plan — Case-Scoped Handwriting Banner

- [ ] 1. Scope the DAL query to the case instead of a document-ID set
  - Change `getDocumentsContainingHandwriting` in `api/DAL/document-dal.js` to take
    no arguments and scope to the selected case
  - Write an explicit `bool` query (do NOT reuse `buildQueryJson`, which is a
    keyword-relevance builder); follow the pattern of
    `getPageMetadataByDocumentIdAndPageNumber`
  - Query the `page_metadata` index, scoping by `case_ref` (a mapped indexed
    `keyword`), with the `page_contains_handwriting: true` filter, `size: 0`, and a
    `terms` aggregation on `source_doc_id`
  - `page_metadata` is preferred over `chunks` (both carry the fields) for
    consistency with the rest of the feature (commits `215aa5e`, `d7e6c62`) and
    because it holds one entry per page rather than many chunks
  - Return the distinct matching `source_doc_id`s; return `[]` when no buckets
  - Update the DAL JSDoc/type signature to drop the `documentIds` parameter
  - _Requirements: 2.1, 2.3, 2.4_

- [ ] 2. Update DAL tests
  - Update `api/DAL/document-dal.test.js`: call with no args; assert the query
    targets the `page_metadata` index and scopes by `case_ref` (replacing the old
    `terms: { source_doc_id }` chunks-index assertion); assert distinct IDs from
    aggregation buckets, the empty-result case, and `VError` on failure
  - _Requirements: 2.1, 2.4, 4.1_

- [ ] 3. Resolve the banner by CRN in the search route
  - In `search/routes.js`, rewrite `resolveHasHandwriting` to take
    `{ session, crn, logger, createDocumentDAL }`, return the session cache on hit,
    otherwise call the DAL and cache a boolean
  - Return `false` when no CRN is present or when the DAL fails (warn log)
  - Update the `GET /search` call site to pass `crn` and stop mapping
    `source_doc_id`s from hits for the banner
  - Remove the now-unused hit-derived `documentIds` plumbing for the banner
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 4.1, 4.2_

- [ ] 4. Update search route tests
  - Update `search/routes.test.js`: banner shown for a handwriting case regardless
    of query term; banner shown even when the search returns zero hits (the
    zero-hit gap); banner absent otherwise; cache-hit path skips a second DAL call;
    DAL failure renders results with the banner absent and a warn log
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1_

- [ ] 5. Invalidate the cache on case change
  - In `middleware/getCaseReferenceNumberFromQueryString/index.js`, clear
    `req.session.hasHandwriting` when the incoming valid CRN differs from the one
    already on the session; preserve it when unchanged
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 6. Update case-selection middleware tests
  - Update `middleware/getCaseReferenceNumberFromQueryString/index.test.js`: clears
    on CRN change, preserves on same CRN, no-op when no valid CRN
  - _Requirements: 3.2, 3.3_

- [ ] 7. Confirm banner markup is untouched and verify end to end
  - Confirm `search/page/results.njk` banner markup, styling, and copy are unchanged
  - Run `npm test`, `npm run lint`, `npm run format`, `npm run sass`,
    `npm run openapi:build`
  - _Requirements: 4.3_
