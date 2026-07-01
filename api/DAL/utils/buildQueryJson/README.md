# buildQueryJson

Builds an OpenSearch query DSL object for a given query mode.

- Search queries are assembled by `queryTypeBuilders.js` (driven by `searchType`).
- Non-search structural queries are assembled by `queryStructureBuilders.js` (driven by `queryMode`).

## `queryMode` values

| `queryMode` | Default | Description |
|---|:---:|---|
| `search` | ✅ | Uses `searchType` and `queryTypeBuilders` to build chunk search DSL. |
| `page-metadata` | | Uses `queryStructureBuilders` to build page metadata lookup DSL. |

## Structure Builders

`queryStructureBuilders.js` defines non-search query shapes.

- `QUERY_MODES.SEARCH`: canonical default mode value.
- `QUERY_MODES.PAGE_METADATA`: page metadata lookup mode.
- `DEFAULT_QUERY_MODE`: currently `QUERY_MODES.SEARCH`.

When `queryMode` is `page-metadata`, `buildQueryJson` builds:

- `bool.must` with `source_doc_id` match
- `bool.must` with `page_num` match

`_source` projection is set in `buildQueryJson` when `options.sourceFields` is provided.

## `searchType` values

| `searchType` | Default | Description |
|---|:---:|---|
| `keyword` | | Lexical (BM25) match against `chunk_text`. No date extraction. |
| `keyword-dates` | | Lexical match with date phrase extraction and format-variant expansion. |
| `semantic` | | Neural vector match via the `embedding` field. No date extraction. |
| `hybrid` | | Combined BM25 + neural with configurable per-clause boost factors. No date extraction. |
| `hybrid-dates` | ✅ | Combined BM25 + neural with date phrase extraction and format-variant expansion. |

## Valid `searchType` modes

| `searchType` | Effective mode | OpenSearch query type |
|---|---|---|
| `keyword` | Keyword only | `bool` with `match` |
| `keyword-dates` | Keyword + dates | `bool` with `match` + `match_phrase` date variants |
| `semantic` | Semantic only | standalone `neural` with scoped `filter` |
| `hybrid` | Hybrid | `bool` with boosted `match` + boosted `neural` |
| `hybrid-dates` | Hybrid + dates | `bool` with boosted `match` + boosted `match_phrase` date variants + boosted `neural` |

## Boost constants

Boosts are only applied in hybrid modes (`searchType: 'hybrid'` or `'hybrid-dates'`). They have no effect in keyword-only or semantic-only modes.

These values are defined in `DEFAULT_QUERY_DSL_CONFIG` and can be overridden through `queryDslConfig`:

| Config key | Default | Controls |
|---|---|---|
| `lexicalBoost` | `20` | Weight of the BM25 `match` clause relative to neural |
| `dateBoost` | `1` | Weight of the grouped `match_phrase` date clauses |
| `neuralBoost` | `4` | Weight of the `neural` clause |

## Neural filter

All queries that include a `neural` clause attach a `filter` to pre-scope the ANN (approximate nearest neighbour) search to the correct case — and optionally to a specific document page when `documentId` is supplied. Without this, OpenSearch retrieves the top `k` candidates from across all cases before the outer `bool.filter` term filter discards irrelevant results, wasting the `k` budget on noise.

- **Case-scoped** (search results): `filter: { term: { case_ref: '...' } }`
- **Page-scoped** (document chunk viewer): `filter: { bool: { filter: [{ term: { case_ref } }, { term: { source_doc_id } }, { term: { page_number } }] } }`

When there is only a single filter clause and the keyword is non-empty (pure semantic, no `documentId`), the `bool.filter` wrapper is unwrapped to a direct `term` clause.

## Usage

```js
import buildQueryJson from './index.js';

// Hybrid + dates (BM25 + neural + date phrase expansion)
const hybridDatesQuery = buildQueryJson({
    keyword: 'knee injury 12 January 2020',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    options: {
        searchType: 'hybrid-dates',
        sourceFields: { excludes: ['embeddings'] },
        logger
    }
});

// Keyword + dates (BM25 match + date phrase expansion)
const keywordDatesQuery = buildQueryJson({
    keyword: 'hospital visit 12/01/2020',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    options: { searchType: 'keyword-dates', logger }
});

// Pure semantic (neural only, no date expansion)
const semanticQuery = buildQueryJson({
    keyword: 'what injuries did the applicant suffer?',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    options: { searchType: 'semantic', logger }
});

// Keyword only (BM25, no date expansion)
const keywordQuery = buildQueryJson({
    keyword: 'physiotherapy report',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    options: { searchType: 'keyword', logger }
});

// Page metadata lookup (non-search structure mode)
const pageMetadataQuery = buildQueryJson({
    keyword: '',
    caseReferenceNumber: '26-711111',
    pageNumber: '5',
    options: {
        queryMode: 'page-metadata',
        includePagination: false,
        documentId: 'doc-123',
        logger
    }
});
```

## How dates work

When `searchType` is `keyword-dates` or `hybrid-dates`:

1. `extractDatesFromSearchString` scans the keyword for date-like phrases (e.g. `12th January 2020`, `12/01/20`).
2. Matched phrases are removed from the remaining text.
3. `generateDateFormatVariants` expands each phrase into multiple normalised formats.
4. Each variant becomes a `match_phrase` clause against `chunk_text`.
5. The remaining non-date text becomes a `match` clause (keyword/hybrid mode) or is sent as `query_text` to the neural model (semantic mode).

Date variant counts above `VARIANT_THRESHOLD` (50) or should clause counts above `SHOULD_THRESHOLD` (50) trigger a warning log.
