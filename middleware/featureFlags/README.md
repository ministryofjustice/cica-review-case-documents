# Feature Flags

Runtime feature flags are stored in the Express session (`req.session.featureFlags`) and applied to every request by the `featureFlags` middleware.

## Available flags

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `align` | `boolean` | `true` | Enable alignment of image highlight bounding boxes to prevent overlaps |
| `type` | `string` | `hybrid-dates` | Search mode - controls which OpenSearch query strategy is used |
| `debug` | `boolean` | `false` | Show debug panel with diagnostic info, DSL queries, feature flags, and request details |

## Toggling flags via URL

Boolean flags (`align`, `debug`) are toggled with `on` / `off`.

The `type` flag accepts a recognised search type value:

```
/search?type=hybrid-dates          → hybrid-dates  (default)
/search?type=hybrid                → hybrid
/search?type=keyword-dates         → keyword-dates
/search?type=keyword               → keyword
/search?type=semantic              → semantic
/search?align=off                  → disable bounding-box alignment
/search?debug=on                   → enable debug panel
/search?type=hybrid-dates&align=off → hybrid-dates + alignment off
/search?type=semantic&debug=on     → semantic search + debug panel
```

The middleware persists the resolved value to the session, so subsequent requests within the same session retain the setting without repeating the query parameter.

> **Note:** The value must match a supported search mode **exactly**. An invalid value (for example `semantic,dates`) is ignored and the system falls back to the existing session value, or the default when no session value exists.

## Search mode values

| `type` value | Query strategy |
|---|---|
| `hybrid-dates` _(default)_ | BM25 + neural + date phrase expansion |
| `hybrid` | BM25 + neural, no date extraction |
| `keyword-dates` | BM25 + date phrase expansion |
| `keyword` | BM25 only |
| `semantic` | Neural vector only |

## Accessing flags

All feature-flag access **should** use `getFeatureFlagValue(session, flagName)` rather than directly accessing `session.featureFlags`. This ensures consistent validation and fallback behavior across the entire app:

```javascript
import { getFeatureFlagValue } from './middleware/featureFlags/index.js';

// ✅ Correct - normalized and validated
const alignFlag = getFeatureFlagValue(req.session, 'align');     // boolean
const searchType = getFeatureFlagValue(req.session, 'type');      // string

// ⚠️ Direct access - only acceptable to avoid circular dependencies
const sessionType = session?.featureFlags?.type;                 // direct access (see note below)

// ❌ Incorrect - bypasses validation and normalization
const alignFlag = req.session?.featureFlags?.align;              // unvalidated
const searchType = req.session?.featureFlags?.type;              // unvalidated - use getFeatureFlagValue instead
```

The `getFeatureFlagValue` accessor handles all validation:
- **Boolean flags** (`align`, `debug`): Type-checks and rejects mismatched types; falls back to default.
- **String flags** (`type`): Calls `resolveSearchType()` internally to canonicalize and validate the search mode.

This centralizes all feature-flag logic in one place, making it easier to maintain and test.

### Exception: Direct access when circular dependencies exist

In rare cases, directly accessing `session.featureFlags` is acceptable if importing `getFeatureFlagValue` would create a circular dependency. Example: `api/search/constants/searchTypes.js` uses direct access to avoid importing from `middleware/featureFlags/index.js` (which itself imports `DEFAULT_SEARCH_TYPE` from `searchTypes.js`).

When using direct access:
1. **Document why** — add a comment explaining the circular dependency risk
2. **Validate the value** — check against allowed values before using (e.g., `Object.values(SEARCH_TYPES).includes(sessionType)`)
3. **Fallback to defaults** — return a safe default if validation fails
4. **Keep it minimal** — only access the specific flag you need, validate it, and return

## Implementation

- `DEFAULT_SEARCH_TYPE` — exported from `api/search/constants/searchTypes.js`; the single source of truth for the default (`hybrid-dates`).
- `FEATURE_FLAG_DEFAULTS` — the baseline value for each flag when not set in session. Its `type` field is set to `DEFAULT_SEARCH_TYPE`.
- `parseFeatureFlagValue(value)` — parses `'on'`→`true`, `'off'`→`false`, anything else→`undefined`.
- `parseEnumFlagValue(value, allowedValues?)` — parses a string flag, with optional allowlist.
- `getFeatureFlagValue(session, flagName)` — **Canonical accessor.** Resolves a flag from session with proper validation and fallback to defaults. Automatically applies `resolveSearchType()` for the `type` flag.
- `featureFlags` (default export) — Express middleware that reads query params, updates session, and sets `res.locals.featureFlags`.

## Debug mode

The `debug` flag enables a comprehensive debug panel that renders as an overlay on the page when enabled (`?debug=on`). 

The panel displays:
- **Environment & Session** — environment (dev/prod), user info, case reference number, request timestamp
- **Feature Flags** — current state of all flags with GOV.UK tags (boolean flags show "On"/green or "Off"/red; non-boolean flags show as monospace values)
- **Current Request** — HTTP method, path, query parameters
- **Search Info** — search query, execution time, generated DSL, previous DSL queries
- **Document Info** — document ID, current page, highlights count, alignment status

The debug panel is implemented through:
1. **middleware/debug/index.js** — Collects diagnostic data into `res.locals.debugInfo` so route handlers can attach request/search/document metadata.
2. **partial/debug-panel.njk** — Renders the styled overlay panel when the debug flag is active.

To use debug mode in development:

```
/search?type=semantic&debug=on     → search with semantic mode + debug panel
/document/ABC123?page=1&debug=on   → document viewer + debug panel
```

The debug panel appears as a full-height slide-in panel anchored to the right side of the viewport (max 500px wide). It is toggled via a fixed trigger button positioned at the top-right corner of the page. The panel contains collapsible sections for browsing diagnostic data.
