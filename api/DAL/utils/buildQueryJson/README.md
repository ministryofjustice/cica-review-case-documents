# buildQueryJson

Builds an OpenSearch query DSL object from three independently toggled search capabilities.

## Search flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `useKeyword` | `boolean` | `true` | Enable lexical (BM25) matching against `chunk_text` |
| `useSemantic` | `boolean` | `false` | Enable neural vector matching via the `embedding` field |
| `enableDateExtraction` | `boolean` | `true` | Extract date phrases from the query and expand them into format variants (e.g. `12 Jan 2020`, `12/01/2020`) for `match_phrase` clauses |

At least one of `useKeyword` or `useSemantic` must be `true`.

## Valid combinations

| `useKeyword` | `useSemantic` | `enableDateExtraction` | Effective mode | OpenSearch query type |
|:---:|:---:|:---:|---|---|
| ✅ | ❌ | ❌ | Keyword only | `bool` with `match` |
| ✅ | ❌ | ✅ | Keyword + dates | `bool` with `match` + `match_phrase` date variants |
| ❌ | ✅ | ❌ | Semantic only | standalone `neural` with filter |
| ❌ | ✅ | ✅ | Semantic + dates | `bool` with `match_phrase` date variants + `neural` |
| ✅ | ✅ | ❌ | Hybrid | `bool` with boosted `match` + `neural` |
| ✅ | ✅ | ✅ | Hybrid + dates | `bool` with boosted `match` + `match_phrase` date variants + `neural` |

## Boost constants

Only relevant when `useSemantic` is `true` (hybrid modes).

| Constant | Default | Controls |
|---|---|---|
| `DEFAULT_LEXICAL_BOOST` | `12` | Weight of the BM25 `match` clause relative to neural |
| `DEFAULT_DATE_BOOST` | `1` | Weight of the grouped `match_phrase` date clauses |
| `DEFAULT_NEURAL_BOOST` | `4` | Weight of the `neural` clause |

These can be overridden per-call via `keywordBoost`, `dateBoost`, and `semanticBoost` parameters.

## Usage

```js
import buildQueryJson from './index.js';

// Hybrid + dates (all capabilities on)
const query = buildQueryJson({
    keyword: 'knee injury 12 January 2020',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    useKeyword: true,
    useSemantic: true,
    enableDateExtraction: true,
    logger
});

// Pure semantic (no lexical, no date expansion)
const semanticQuery = buildQueryJson({
    keyword: 'what injuries did the applicant suffer?',
    caseReferenceNumber: '26-711111',
    pageNumber: 1,
    itemsPerPage: 10,
    useKeyword: false,
    useSemantic: true,
    enableDateExtraction: false,
    logger
});
```

## How dates work

When `enableDateExtraction` is `true` and `useKeyword` is `true` (or `useSemantic` is `true`):

1. `extractDatesFromSearchString` scans the keyword for date-like phrases (e.g. `12th January 2020`, `12/01/20`).
2. Matched phrases are removed from the remaining text.
3. `generateDateFormatVariants` expands each phrase into multiple normalised formats.
4. Each variant becomes a `match_phrase` clause against `chunk_text`.
5. The remaining non-date text becomes a `match` clause (keyword mode) or is sent as `query_text` to the neural model (semantic mode).

Date variant counts above `VARIANT_THRESHOLD` (50) or should clause counts above `SHOULD_THRESHOLD` (50) trigger a warning log.
