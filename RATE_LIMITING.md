 # Rate Limiting Architecture

## Overview

This application implements a layered, context-aware rate limiting strategy designed for a VPN-gated, Entra SSO environment. Rate limiting is applied at three levels:

1. Entra Auth Endpoints — Protection against auth endpoint abuse
2. API Endpoints — Protection against programmatic abuse
3. Web App Routes — Protection against general DOS attacks

## Diagrams

- [Rate limiting architecture](diagrams/RATE_LIMITING_ARCHITECTURE.mermaid)
- [Rate limiting key strategy](diagrams/RATE_LIMITING_KEY_STRATEGY.mermaid)


## Rate Limiters by Endpoint

1. Entra Authentication Endpoints

Location: [entraRateLimiter.js](auth/rateLimiters/entraRateLimiter.js)

| **Endpoint**  | **Limit**| **Window** | **Key** | **Purpose**                                                                  |
|---------------|----------|------------|---------|------------------------------------------------------------------------------|
|/auth/login	| 20 req   |	15 min	| IP	  | Prevent brute-force on login initiation                                      |
|/auth/callback	| 40 req   |	15 min	| IP	  | Allow higher limit for callback retries (failed consent, account selection)  |


Key Strategy: IP-based (all users behind same VPN IP share the bucket)

Rationale:

- Lightweight auth endpoints targeting abuse attempts
- Entra itself provides additional rate limiting
- Higher callback limit accommodates legitimate retry scenarios (e.g., AADSTS65001, AADSTS16000)

Environment Variables:

APP_ENTRA_RATE_LIMIT_WINDOW_MS=900000          # 15 minutes (default)  
APP_ENTRA_RATE_LIMIT_MAX_LOGIN=20              # Login endpoint limit  
APP_ENTRA_RATE_LIMIT_MAX_CALLBACK=40           # Callback endpoint limit

2. API Endpoints

Location: [api/middleware/rateLimiter/index.js](api/middleware/rateLimiter/index.js)

| **Auth Status** | **Limit** | **Window** | **Key**        | **Purpose**                      |
|-----------------|-----------|------------|----------------|----------------------------------|
| Authenticated	  | 1000 req  |	15 min	   | JWT ID or OID  | Per API consumer or user         |
| Unauthenticated | 50 req    |	15 min	   | IP	            | Programmatic client protection   |

Key Strategy:

- Authenticated: JWT id field, with fallback to req.session.entraUser.oid
- Unauthenticated: IP address

Middleware Placement:

- Placed AFTER JWT authentication (validates token signature before rate limiting)
- Lightweight auth check to avoid CodeQL auth-before-ratelimit warnings

Environment Variables:

API_RATE_LIMIT_MAX_AUTH=1000                   # Authenticated API limit
API_RATE_LIMIT_MAX_UNAUTH=50                   # Unauthenticated API limit
API_RATE_LIMIT_WINDOW_MS=900000                # 15 minutes (default)

3. Web App Routes (General)

Location: [middleware/rateLimiter/index.js](middleware/rateLimiter/index.js)

Applied globally after session middleware but before route handlers.

| **Auth Status** | **Limit** | **Window** | **Key**         | **Purpose**              |
|-----------------|-----------|------------|-----------------|--------------------------|
| Authenticated	  | 1000 req  |	15 min	   | oid:<entra-oid> | Per authenticated user   |
| Unauthenticated | 500 req   |	15 min	   | IP	             | VPN users share IP       |

Key Strategy:

- Authenticated: oid:<entra-oid> (stable per-user, survives session regeneration)
- Unauthenticated: IP address (from express-rate-limit's ipKeyGenerator)

Why the OID prefix?

- Prevents key collision if an OID string value happens to match an IP or session ID

Environment Variables:

APP_RATE_LIMIT_MAX_AUTH=1000                   # Authenticated web limit  
APP_RATE_LIMIT_MAX_UNAUTH=500                  # Unauthenticated web limit  
APP_RATE_LIMIT_WINDOW_MS=900000                # 15 minutes (default)


## Request Flow Example

### Authenticated User Accessing search endpoints

```
GET /search?query=test
[Session cookie with loggedIn=true, entraUser.oid set]
    ↓
[Pass through generalRateLimiter]
    ↓
Check: req.session?.loggedIn && req.session?.entraUser?.oid
    ↓
Key = "oid:<user-entra-oid>"
Limit = 1000 req/15min
    ↓
Bucket lookup: Rate limit store["oid:<user-entra-oid>"]
    ↓
Count < 1000? → Continue to /search handler
Count >= 1000? → Return 429 Too Many Requests
```

### Unauthenticated User Accessing search endpoints (Redirects to Login)

```
GET /search?query=test
[No session, or session.loggedIn=false]
    ↓
[Pass through generalRateLimiter]
    ↓
Check: req.session?.loggedIn? NO
    ↓
Key = ipKeyGenerator(req.ip)
      = "::ffff:10.0.0.5" (or similar)
Limit = 500 req/15min
    ↓
Bucket lookup: Rate limit store["::ffff:10.0.0.5"]
    ↓
Count < 500? → Continue, then isAuthenticated middleware redirects to /auth/login
Count >= 500? → Return 429 Too Many Requests (blocks before redirect)
```

### API Request with JWT
```
GET /api/search?query=test
Authorization: Bearer <jwt>
    ↓
[JWT extraction & validation]
    ↓
[createDynamicRateLimiter checks]
    ↓
Check: req.decodedToken exists? YES
    ↓
Limit = 1000 req/15min
Key = req.decodedToken.id (or fallback to req.session.entraUser.oid)
    ↓
Count < 1000? → Continue to /search handler
Count >= 1000? → Return 429 Too Many Requests
```


## Rate Limiting Hierarchy

```
Strictest ←→ Least Strict

Entra Endpoints:
  /auth/login        : 20 req/15min  (IP-based)
  /auth/callback     : 40 req/15min  (IP-based, allows retries)

API Endpoints:
  Unauth            : 50 req/15min  (IP-based, programmatic protection)
  Auth              : 1000 req/15min (JWT ID or OID)

Web Routes:
  Unauth            : 500 req/15min  (IP-based, VPN users)
  Auth              : 1000 req/15min (OID-based, per user)
```

## Design Rationale

Why OID for Authenticated Web Users?

1. Stability: Survives session regeneration (which occurs during login)
2. Per-Person: One user, one limit bucket (even across multiple browsers)
3. Entra Integration: Direct mapping to user identity

Why IP for Unauthenticated?

1. Only Identifier: No session/auth context yet
2. VPN Mitigation: While multiple users may share a VPN IP, the total bucket (500 for web, 50 for API, 20-40 for auth) is sized to accommodate normal concurrent usage
3. Tradeoff Accepted: VPN whitelisting is the primary security boundary; rate limiting is secondary DOS protection

Why Different Limits for Web vs API?

- Web (500 unauth): Includes page navigation, redirects, CSS/JS loads = more requests
- API (50 unauth): Programmatic clients = stricter to prevent abuse

Why Higher Callback Limit?

- /auth/callback is called by Entra, not directly by user
- May need retries for consent/account selection scenarios (AADSTS65001, AADSTS16000)
- 40 allows ~2-3 retry cycles per user per window

## Configuration Examples

### Default Configuration (Production)

```
# Entra auth endpoints
APP_ENTRA_RATE_LIMIT_WINDOW_MS=900000
APP_ENTRA_RATE_LIMIT_MAX_LOGIN=20
APP_ENTRA_RATE_LIMIT_MAX_CALLBACK=40

# API endpoints
API_RATE_LIMIT_MAX_AUTH=1000
API_RATE_LIMIT_MAX_UNAUTH=50
API_RATE_LIMIT_WINDOW_MS=900000

# Web app
APP_RATE_LIMIT_MAX_AUTH=1000
APP_RATE_LIMIT_MAX_UNAUTH=500
APP_RATE_LIMIT_WINDOW_MS=900000
```

### Relaxed for High-Traffic Environment

```
# More generous for authenticated users
APP_RATE_LIMIT_MAX_AUTH=2000
API_RATE_LIMIT_MAX_AUTH=2000

# More generous for unauthenticated (longer login flows)
APP_RATE_LIMIT_MAX_UNAUTH=1000
API_RATE_LIMIT_MAX_UNAUTH=100
```

### Strict for Low-Trust Environment

```
# Tighter limits across the board
APP_RATE_LIMIT_MAX_AUTH=500
API_RATE_LIMIT_MAX_AUTH=500
APP_RATE_LIMIT_MAX_UNAUTH=200
API_RATE_LIMIT_MAX_UNAUTH=20
```

## Error Responses

All rate limiters return HTTP 429 with a JSON error body:

```
{
  "error": "Too many requests, please try again later"
}
```

For Entra-specific endpoints, the message is slightly different:
```
{
  "error": "Too many authentication requests, please try again later"
}
```

## Summary Table

| **Component** | **Endpoint(s)** | **Auth Status** | **Limit**  | **Window** | **Key**       |
|---------------|-----------------|-----------------|------------|------------|---------------|
| Entra	        | /auth/login     | N/A             | 20/15min   | 15 min     | IP            |
| Entra         | /auth/callback  |	N/A             | 40/15min	 | 15 min     | IP            |
| API           | /api/*          |	Yes 	        | 1000/15min | 15 min     | JWT ID or OID | 
| API           | /api/*          |	No  	        | 50/15min	 | 15 min     | IP            | 
| Web           | /*              |	Yes	            | 1000/15min | 15 min	  | OID           |
| Web           | /*              |	No  	        | 500/15min  | 15 min     | IP            |
