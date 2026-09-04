# Requirements — Case-Scoped Handwriting Banner

## Background

The search results page shows a banner indicating that a case document (medical
report) contains handwriting, so reviewers know to check it carefully. During
ingestion a `page_contains_handwriting` flag is derived from the OCR response and
denormalised onto every chunk and page index entry. There is no document-level
index, so the flag must be resolved by querying chunk/page data.

For this story a case has exactly one medical report. Every user session is scoped
to a single case (a Case Reference Number, "CRN", is selected via Tempus before any
search or view). The foreseeable future may introduce multiple documents per case
(up to ~12), at which point the banner copy and placement will change anyway.

## Problem With The Current Implementation

The current implementation (branch
`feature/cicads-731/handwriting-info-search-results`) derives the banner from the
**search result hits**: it collects the `source_doc_id`s present in the current
page of results, batches a query for the uncached ones, caches true/false per
document in the session, and shows the banner if any resolved document contains
handwriting.

Handwriting is a property of the **document**, not of the case and not of a query.
The intended question is *"does a document within the current case contain
handwriting?"* The case is the scope we resolve that document property within —
today there is exactly one document per case, so the answer collapses into a single
banner, but the property being reported is still the document's.

### What the current implementation gets right

To be precise about the actual behaviour: the DAL query filters
`page_contains_handwriting: true` across **all chunks of each supplied document**,
independent of the search term. So for any document it is given, it correctly
answers "does any page of this document contain handwriting" — it does **not** only
inspect the chunks that matched the search. For the current one-document-per-case
story, that document normally appears in the results whenever the query matches
anything in it, so in the common case the banner is correct today.

### The actual flaw

The defect is **architectural**: the set of documents to check is sourced from the
**current page of search hits** (`source_doc_id`s on the returned hits) rather than
from the documents belonging to the case. A document is only checked if it surfaces
in the results. This produces two concrete gaps:

- **Zero-hit gap (today):** if the search term matches nothing in the case, there
  are no hits, no document IDs are supplied, and the banner is absent even though
  the case's document contains handwriting. Low consequence in isolation (the user
  is on an empty results page), but it is behaviour driven by the query rather than
  by the document.
- **Multi-document gap (foreseeable future):** with more than one document per case,
  a handwritten document that does not match the current query never appears in the
  hits and is never checked — so a handwritten document can be missed while other
  results are shown. This is the material behavioural defect the rework prevents.

The cache design (session-scoped) is fine. The Data Access Layer (DAL) query
correctly checks whole documents. The flaw is solely that the **input set** of
documents is sourced from search results rather than from the documents belonging
to the case.

## Correct Model

Handwriting remains a per-document property. We resolve that property for the
document(s) belonging to the selected case, scoped by CRN, and cache the result for
the session.

```
Case selected (CRN) → session
  → query by CRN: which document(s) belonging to this case contain handwriting
  → store the result (the document(s) that contain handwriting) in the session
  → if a different case is selected, clear this from the session and resolve again
```

Today there is one document per case, so this surfaces as a single banner. The
property being resolved and stored is the document's; the case only bounds which
documents we look at.

## Requirements

### Requirement 1 — Banner reflects the document property, not the query

**User story:** As a reviewer, I want the handwriting banner to reflect whether a
document within my selected case contains handwriting regardless of my search term,
so that I am not misled into skipping a handwritten document.

#### Acceptance Criteria

1. WHEN a case containing a document with handwriting is selected THEN the banner
   SHALL be shown on the search results page regardless of the search term entered.
2. WHEN a case whose document(s) contain no handwriting is selected THEN the banner
   SHALL NOT be shown.
3. WHEN the search term returns zero results for a case whose document contains
   handwriting THEN the banner SHALL still reflect the document's handwriting status
   (it SHALL NOT depend on whether the query produced hits). *(This is the zero-hit
   gap in the current implementation.)*
4. WHEN a case contains more than one document AND a handwritten document does not
   match the current search term THEN that document's handwriting status SHALL still
   be reflected. *(This is the multi-document gap the current implementation cannot
   satisfy, because unmatched documents never enter the hit set.)*
5. WHEN results span multiple pages THEN the banner SHALL be consistent across all
   result pages for the same case and query.
6. THE handwriting status SHALL be determined per document; the case-level banner
   is the aggregate ("at least one document in this case contains handwriting")
   and the underlying per-document result SHALL be retained to support future
   per-document labelling.

### Requirement 2 — Resolve handwriting status by CRN

**User story:** As a maintainer, I want handwriting status resolved from the case
reference rather than search hits, so the logic matches the question being asked
and is simpler to reason about.

#### Acceptance Criteria

1. WHEN handwriting status is resolved THEN the system SHALL query by the case
   reference number, not by document IDs extracted from search hits.
2. THE search route SHALL NOT extract, thread, or reconcile `source_doc_id`s from
   search result hits for the purpose of the banner.
3. THE DAL query SHALL scope to the case with an explicit `bool` query (following
   the existing `getPageMetadataByDocumentIdAndPageNumber` pattern) rather than
   through `buildQueryJson`, which is a keyword-relevance builder and not
   appropriate for a scoped existence check.
4. THE DAL SHALL return the distinct set of `source_doc_id`s in the case that
   contain handwriting (so the boolean is derivable today and the set is available
   for future per-document labelling).

### Requirement 3 — Cache in session and invalidate on case change

**User story:** As a reviewer, I want handwriting status resolved once per case, so
repeated searches within the same case do not re-query, and switching cases never
shows stale information.

#### Acceptance Criteria

1. WHEN handwriting status has been resolved for the current case THEN subsequent
   searches within the same session SHALL use the cached value without querying
   OpenSearch again.
2. WHEN a different CRN is selected THEN the cached handwriting status SHALL be
   cleared before the new case's status is resolved.
3. WHEN the same CRN is re-selected (no change) THEN the cached value SHALL be
   preserved.
4. THE cache invalidation SHALL occur at the single point where the CRN is written
   to the session, so it applies regardless of entry route.

### Requirement 4 — Resilience and no regression

**User story:** As a reviewer, I want search to keep working even if the handwriting
check fails, so a non-critical banner never breaks the results page.

#### Acceptance Criteria

1. IF the handwriting resolution query fails THEN the search results SHALL still
   render AND the failure SHALL be logged at warn level AND the banner SHALL be
   treated as absent.
2. WHEN no CRN is present on the session THEN the banner SHALL be treated as absent
   without querying.
3. THE existing banner markup, styling, and copy SHALL be unchanged by this work
   (only the data feeding it changes).

## Out Of Scope

- Per-document handwriting labelling (multiple documents per case). The DAL returns
  the set to make this cheap later, but the UI remains a single case-level banner.
- A document-level index. Resolution continues to use chunk/page data.
- Changes to ingestion or the derivation of `page_contains_handwriting`.
