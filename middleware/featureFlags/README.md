# Feature Flags

Runtime feature flags are stored in the Express session (`req.session.featureFlags`) and applied to every request by the `featureFlags` middleware.

## Available flags

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `align` | `boolean` | `true` | Enable alignment of image highlight bounding boxes to prevent overlaps |
| `type` | `string` | `hybrid-dates` | Search mode - controls which OpenSearch query strategy is used |

## Toggling flags via URL

Boolean flags (`align`) are toggled with `on` / `off`.

The `type` flag accepts a recognised search type value:

```
/search?type=hybrid-dates          → hybrid-dates  (default)
/search?type=hybrid                → hybrid
/search?type=keyword-dates         → keyword-dates
/search?type=keyword               → keyword
/search?type=semantic              → semantic
/search?align=off                  → disable bounding-box alignment
/search?type=hybrid-dates&align=off → hybrid-dates + alignment off
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

All feature-flag access **must** use `getFeatureFlagValue(session, flagName)` rather than directly accessing `session.featureFlags`. This ensures consistent validation and fallback behavior across the entire app:

```javascript
import { getFeatureFlagValue } from './middleware/featureFlags/index.js';

// ✅ Correct - normalized and validated
const alignFlag = getFeatureFlagValue(req.session, 'align');     // boolean
const searchType = getFeatureFlagValue(req.session, 'type');      // string

// ❌ Incorrect - bypasses validation and normalization
const alignFlag = req.session?.featureFlags?.align;              // unvalidated
const searchType = req.session?.featureFlags?.type;              // unvalidated
```

The `getFeatureFlagValue` accessor handles all validation:
- **Boolean flags** (`align`): Type-checks and rejects mismatched types; falls back to default.
- **String flags** (`type`): Calls `resolveSearchType()` internally to canonicalize and validate the search mode.

This centralizes all feature-flag logic in one place, making it easier to maintain and test.

## Implementation

- `DEFAULT_SEARCH_TYPE` — exported from `api/search/constants/searchTypes.js`; the single source of truth for the default (`hybrid-dates`).
- `FEATURE_FLAG_DEFAULTS` — the baseline value for each flag when not set in session. Its `type` field is set to `DEFAULT_SEARCH_TYPE`.
- `parseFeatureFlagValue(value)` — parses `'on'`→`true`, `'off'`→`false`, anything else→`undefined`.
- `parseEnumFlagValue(value, allowedValues?)` — parses a string flag, with optional allowlist.
- `getFeatureFlagValue(session, flagName)` — **Canonical accessor.** Resolves a flag from session with proper validation and fallback to defaults. Automatically applies `resolveSearchType()` for the `type` flag.
- `featureFlags` (default export) — Express middleware that reads query params, updates session, and sets `res.locals.featureFlags`.
