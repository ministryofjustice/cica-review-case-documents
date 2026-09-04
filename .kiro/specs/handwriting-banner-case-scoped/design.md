# Design — Case-Scoped Handwriting Banner

## Overview

Rework the handwriting banner so it reports a per-document property, resolved for
the document(s) belonging to the selected case, cached in the session, and
invalidated when the case changes. This replaces the current approach of deriving
the banner from the `source_doc_id`s present in the current page of search hits.

## Domain Model

Handwriting is a property of the **document**, not of the case and not of a search
query. The case (CRN) is only the **scope** that bounds which documents we resolve
that property for.

- Per-document truth: "document X contains handwriting" (derived from the
  `page_contains_handwriting` flag on that document's chunks/pages).
- Case-level banner: the **aggregate** of the per-document truth for the documents
  belonging to the case — "at least one document in this case contains
  handwriting."

Today there is exactly one document per case, so the aggregate collapses into a
single banner. This is why the DAL resolves and returns the **set** of documents
that contain handwriting (per-document results), and the route derives the banner
boolean from that set. Keeping the per-document result — rather than only a
case-level boolean — is deliberate: it matches where the property actually lives
and makes future per-document labelling a view change, not a re-architecture.

The change touches three layers, each with a single, well-bounded responsibility:

| Layer | File | Change |
|-------|------|--------|
| Case selection | `middleware/getCaseReferenceNumberFromQueryString/index.js` | Clear cached handwriting status when the CRN changes |
| Search route | `search/routes.js` | Resolve by CRN and session cache; stop reading search hits |
| Data access | `api/DAL/document-dal.js` | Scope the query to the case with an explicit `bool` query (not `buildQueryJson`); drop the `documentIds` argument |

## Architecture

```
Tempus → /?crn=YY-7NNNNN
   │
   ▼
getCaseReferenceNumberFromQueryString  (single CRN write point)
   │   if req.session.caseReferenceNumber !== validCrn:
   │       delete session.hasHandwriting          ← invalidation
   │   session.caseReferenceNumber = validCrn
   ▼
GET /search  (search/routes.js)
   │   resolveHasHandwriting({ session, crn, logger, createDocumentDAL }):
   │       if session.hasHandwriting !== undefined → return it   (cache hit)
   │       else → DAL.getDocumentsContainingHandwriting() → store → return
   ▼
templateParams.hasHandwriting → results.njk banner  (markup unchanged)
```

The browser → main app → API/OpenSearch boundary is preserved. The DAL continues
to query OpenSearch only; no binary content is involved.

## Components And Interfaces

### 1. Case-selection middleware — invalidation

`getCaseReferenceNumberFromQueryString` is the only place the CRN is written to the
session, which makes it the correct and only home for cache invalidation. Clearing
here means every downstream route sees a cache that is valid for the current case,
and no route needs to reason about "did the case change?".

```js
if (validCrn) {
    if (req.session) {
        if (req.session.caseReferenceNumber !== validCrn) {
            // New case selected — drop case-scoped cached data.
            req.session.hasHandwriting = undefined;
        }
        req.session.caseSelected = true;
        req.session.caseReferenceNumber = validCrn;
    }
}
```

### 2. Search route — resolve by CRN, cache the boolean

`resolveHasHandwriting` loses the `documentIds` input entirely. It reads the cache,
and on a miss asks the DAL for the case's handwriting documents and caches a
boolean.

```js
async function resolveHasHandwriting({ session, crn, logger, createDocumentDAL }) {
    if (!crn) {
        return false;
    }
    if (session?.hasHandwriting !== undefined) {
        return session.hasHandwriting;
    }

    try {
        const dal = createDocumentDAL({ caseReferenceNumber: crn, logger });
        const documentIds = await dal.getDocumentsContainingHandwriting();
        const hasHandwriting = documentIds.length > 0;
        if (session) {
            session.hasHandwriting = hasHandwriting;
        }
        return hasHandwriting;
    } catch (error) {
        logger?.warn?.(
            { err: error, crn },
            'Failed to check handwriting status for case'
        );
        return false;
    }
}
```

Call site (in `GET /search`) drops the ID extraction:

```js
templateParams.hasHandwriting = await resolveHasHandwriting({
    session: req.session,
    crn: req.session?.caseReferenceNumber,
    logger: req.log,
    createDocumentDAL
});
```

**Cache shape decision.** Store a plain boolean (`session.hasHandwriting`) because
the case scope is the unit and today's UI is a single banner. The DAL still returns
the set of matching `source_doc_id`s, so if per-document labelling arrives later,
the cache can be widened to `session.handwritingDocIds` (an array) with the boolean
derived from it — same query, no rework of the resolution flow.

### 3. DAL — scope by case, keep the set

`getDocumentsContainingHandwriting` drops its `documentIds` parameter and scopes to
the case with an explicit `bool` query filtering on `case_ref`. It keeps the
`size: 0` + `terms` aggregation so it returns the distinct matching
`source_doc_id`s without fetching hit documents (no N+1).

**Do not reuse `buildQueryJson` for this query.** `buildQueryJson` is a
relevance-search builder: it requires a `searchType`, dispatches to keyword /
semantic / hybrid builders, performs date-phrase extraction, and assembles
`should` clauses, `minimum_should_match`, boosts, and pagination around a keyword.
The case scoping it applies lives *inside* those per-`searchType` builders, not as a
standalone filter, so it cannot be borrowed in isolation. This query has no
keyword — it is a scoped existence check with an aggregation. Threading it through
`buildQueryJson` (with `keyword: ''`) and then mutating the result to add a filter
and `aggs` is brittle against that builder's internal clause handling.

Instead, follow the pattern already used by `getPageMetadataByDocumentIdAndPageNumber`
in this same DAL: write a small explicit `bool` query. Scope to the case, filter on
`page_contains_handwriting: true`, use `size: 0` with a `terms` aggregation on
`source_doc_id` to return the distinct matching documents.

```js
async function getDocumentsContainingHandwriting() {
    try {
        const response = await db.query({
            index: 'page_metadata',
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { case_ref: caseReferenceNumber } },
                            { term: { page_contains_handwriting: true } }
                        ]
                    }
                },
                size: 0,
                aggs: {
                    documents_with_handwriting: {
                        terms: { field: 'source_doc_id', size: 100 }
                    }
                }
            }
        });

        const buckets =
            response?.body?.aggregations?.documents_with_handwriting?.buckets ?? [];
        return buckets.map((bucket) => bucket.key);
    } catch (err) {
        logger?.error?.({ err }, 'Failed to check documents handwriting');
        throw new VError(err, 'Failed to check handwriting for documents');
    }
}
```

> **Implementation notes for the developer:**
>
> 1. **Index — use `page_metadata` (verified against the index mapping).** The
>    `page_metadata` index template maps the three fields this query needs as
>    indexed fields: `case_ref` (`keyword`), `source_doc_id` (`keyword`), and
>    `page_contains_handwriting` (`boolean`). The display fields (`text`,
>    `s3_page_image_s3_uri`, `correspondence_type`, `page_num`, etc.) are mapped
>    `"index": false`, so the only queryable fields are exactly the ones this query
>    uses. `page_metadata` holds one entry per page (vs many chunks per page on
>    `chunks`), so it scans fewer documents for the same answer, and it matches
>    where the rest of the feature reads the flag from (commits `215aa5e`,
>    `d7e6c62`). Follow the explicit-query pattern of
>    `getPageMetadataByDocumentIdAndPageNumber`, which already targets this index.
> 2. **`case_ref` is the case-scope field.** It is a mapped indexed `keyword` on
>    `page_metadata`, and on `chunks` it is what every builder in
>    `queryTypeBuilders.js` uses (`{ term: { case_ref: caseReferenceNumber } }`).
>    Either index would work; `page_metadata` is preferred for the reasons above.
> 3. **Aggregation size.** `size: 100` on the `terms` agg comfortably covers the
>    foreseeable ~12-documents-per-case ceiling.

## Data Model

No index changes. Resolution relies on the existing `page_metadata` index, whose
template maps `case_ref` (`keyword`), `source_doc_id` (`keyword`), and
`page_contains_handwriting` (`boolean`) as indexed fields — exactly the fields this
query filters and aggregates on. This is preferred over the `chunks` index (which
also carries all three) because it stores one entry per page rather than the flag
denormalised across many chunks, and it is consistent with the rest of the
handwriting feature.

Session state:

- `session.hasHandwriting: boolean | undefined` — `undefined` means "not yet
  resolved for the current case" (cache miss). Cleared on case change.

## Error Handling

- DAL query failure: `resolveHasHandwriting` catches, logs at warn, returns
  `false`. Search results render normally.
- Missing CRN: returns `false` without querying.
- The banner is non-critical UI; failures never surface an error page.

## Testing Strategy

Node test runner, files co-located, `*.test.js`.

- `getCaseReferenceNumberFromQueryString/index.test.js`
  - clears `session.hasHandwriting` when CRN changes
  - preserves it when the same CRN is re-selected
  - does not set it when no valid CRN is present
- `api/DAL/document-dal.test.js`
  - `getDocumentsContainingHandwriting()` scopes by CRN (no `documentIds` arg)
  - returns distinct matching `source_doc_id`s from aggregation buckets
  - returns `[]` when there are no buckets
  - throws `VError` on query failure
- `search/routes.test.js`
  - banner shown when the case has a handwriting document, independent of query
  - banner shown even when the search returns zero hits (the current zero-hit gap)
  - banner absent when the case has none
  - cache hit path does not call the DAL a second time within a session
  - DAL failure → results still render, banner absent, warn logged
  - no `source_doc_id` extraction from hits feeds the banner

Validation: `npm test`, `npm run lint`, `npm run format`, `npm run sass`,
`npm run openapi:build`.

## Migration / Rollout

- No data migration.
- Remove the per-document cache map (`session.hasHandwriting` as an object) in
  favour of a boolean; any stale object-shaped session value is harmless because
  the new code treats a non-boolean the same as needing resolution on the next
  search, and case selection clears it.
