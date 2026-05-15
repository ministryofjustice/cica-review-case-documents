# Feature Flags

Runtime feature flags are stored in the Express session (`req.session.featureFlags`) and applied to every request by the `featureFlags` middleware.

## Available flags

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `align` | `boolean` | `true` | Enable alignment of image highlight bounding boxes to prevent overlaps |
| `type` | `string` | `hybrid-dates` | Search mode - controls which OpenSearch query strategy is used |

## Toggling flags via URL

Boolean flags (`align`) are toggled with `on` / `off`.

The `type` flag accepts a direct search mode slug:

```
/search?type=hybrid-dates          → hybrid-dates  (default)
/search?type=hybrid                → hybrid
/search?type=keyword-dates         → keyword-dates
/search?type=keyword               → keyword
/search?type=semantic              → semantic
/search?align=off                  → disable bounding-box alignment
/search?type=hybrid-dates&align=off → hybrid-dates + alignment off
```

The middleware persists the resolved slug to the session, so subsequent requests within the same session retain the setting without repeating the query parameter.

## Search mode slugs

| `type` slug | Tokens required | OpenSearch strategy |
|---|---|---|
| `hybrid-dates` _(default)_ | `hybrid` + `dates` | BM25 + neural + date phrase expansion |
| `hybrid` | `hybrid` | BM25 + neural, no date extraction |
| `keyword-dates` | `keyword` + `dates` | BM25 + date phrase expansion |
| `keyword` | `keyword` | BM25 only |
| `semantic` | `semantic` | Neural vector only |

## Implementation

- `DEFAULT_SEARCH_TYPE` — exported from `api/search/constants/searchTypes.js`; the single source of truth for the default (`hybrid-dates`).
- `FEATURE_FLAG_DEFAULTS` — the baseline value for each flag when not set in session. Its `type` field is set to `DEFAULT_SEARCH_TYPE`.
- `parseFeatureFlagValue(value)` — parses `'on'`→`true`, `'off'`→`false`, anything else→`undefined`.
- `parseEnumFlagValue(value, allowedValues?)` — parses a string flag, with optional allowlist.
- `getFeatureFlagValue(session, flagName)` — resolves a flag from session with fallback to defaults.
- `featureFlags` (default export) — Express middleware that reads query params, updates session, and sets `res.locals.featureFlags`.
