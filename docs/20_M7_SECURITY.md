# M7 Security hardening

M7 preserves all M1-M6 financial rules and the single-owner access boundary.
No service-role credential, AI endpoint or upload endpoint is introduced.

## HTTP boundary

The frontend calls FastAPI on the server. API CORS is disabled by default (empty
allowlist). Optional API_CORS_ORIGINS is a JSON list of exact HTTPS origins;
HTTP is permitted only for localhost/127.0.0.1 development. Wildcards, credentials,
paths, queries and fragments are rejected. CORS is not authorization: bearer-token
validation and owner checks still apply to every protected request.

API logs contain a generated request UUID, method from a fixed allowlist, matched
route template (never raw path/query), status category and elapsed milliseconds.
They exclude request/response bodies, headers, cookies, tokens, customer data,
raw exception messages and query strings. Disable Uvicorn access and HTTP client
wire logs; unhandled application errors return a generic non-cacheable envelope.
Request IDs are generated locally rather than trusting incoming header values.

Frontend responses deny framing, disable MIME sniffing and use no-referrer.
Next.js same-origin Server Action checks and default body-size bounds remain.
No wildcard Server Action origin exceptions are added.

## Database review

All public application tables must have enabled and forced RLS. Anonymous users
have no table privileges or application RPC execution. Operator/developer identities
must see no business rows and fail every owner RPC. Only customers/accounts/teams
allow direct owner INSERT/UPDATE; domain tables and audit history are read-only to
application roles, with writes only through owner-checked transaction RPCs.
Profiles cannot be self-promoted. No application role can delete or truncate rows.
Private schema helpers are not callable by application roles. Security-definer
functions use an empty search_path and qualified object names.

Migration 202609270003_security.sql removes residual default EXECUTE permissions
on private helper functions. It does not grant any new access or alter calculations.
Regression tests enumerate every current application table and RPC, so newly added
objects must be included explicitly in the security review.

## Upload foundation (closed until M8)

There is no upload route or storage access grant in M7. Do not create a public
screenshot bucket. Before enabling uploads in M8, specify and enforce allowed
raster formats, byte/pixel limits, decoded-content validation, unpredictable owner
object paths, private authorized access, bounded signed URL lifetime, deletion
on completion/failure and a cleanup TTL. Exact limits and retention must be frozen
with M8; no invented retention policy is enabled here. The production checklist
blocks upload activation until these controls and abuse limits are tested.
