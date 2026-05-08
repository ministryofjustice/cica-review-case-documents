# Feature Flags

Runtime feature flags are stored in the Express session (`req.session.featureFlags`) and applied to every request by the `featureFlags` middleware.

## Available flags

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `keyword` | `boolean` | `true` | Enable lexical (BM25) keyword search matching |
| `semantic` | `boolean` | `false` | Enable neural (vector) semantic search matching |
| `dates` | `boolean` | `true` | Enable date extraction and format-variant expansion in lexical matching |
| `align` | `boolean` | `true` | Enable alignment of image highlight bounding boxes to prevent overlaps |

## Toggling flags via URL

Any flag can be toggled by including it as a query parameter with `on` or `off`:

```
/search?keyword=on&semantic=on        → enable hybrid search (keyword + neural)
/search?keyword=on&semantic=off       → keyword only
/search?keyword=off&semantic=on       → semantic only
/search?dates=off                     → disable date extraction
/search?keyword=on&semantic=on&dates=on → hybrid + date expansion (all capabilities)
/search?align=off                     → disable bounding-box alignment
```

The middleware persists the value to the session, so subsequent requests within the same session retain the setting without repeating the query parameter.

## Search mode combinations

| `keyword` | `semantic` | `dates` | Effective mode |
|:---:|:---:|:---:|---|
| on | off | off | Keyword only |
| on | off | on | Keyword + date expansion |
| off | on | off | Semantic only |
| off | on | on | Semantic + date phrases |
| on | on | off | Hybrid |
| on | on | on | Hybrid + date expansion |

## Implementation

- `FEATURE_FLAG_DEFAULTS` — the baseline value for each flag when not set in session.
- `parseFeatureFlagValue(value)` — parses `'on'`→`true`, `'off'`→`false`, anything else→`undefined`.
- `getFeatureFlagValue(session, flagName)` — resolves a flag from session with fallback to defaults.
- `featureFlags` (default export) — Express middleware that reads query params, updates session, and sets `res.locals.featureFlags`.
