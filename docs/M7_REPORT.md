# M7 security verification report

## Scope and findings

M7 only. All existing financial rules, dates, rounding and correction semantics
are unchanged. No real data or credentials were added. No new dependency.

- Existing server identity verification, explicit owner profiles, same-user-token
  database access, parameterized requests and masked accounts remain in place.
- All 15 application tables have forced RLS. Profiles are self-read by owner only.
- customers/accounts/teams: owner SELECT/INSERT/UPDATE; no DELETE/TRUNCATE.
- daily_account_assignments, orders, team_movements, team_daily_activities,
  atm_card_activities, financial_outflows, business_balance_openings, audit_logs,
  idempotency_keys, team_request_keys, money_out_request_keys: owner SELECT only;
  domain mutations use checked transaction RPCs. Openings are administrator-managed.
- All nine public RPCs check owner status before reading/mutating; read functions
  may use invoker security, while definer functions use an empty search_path.
- Private trigger helpers retained PostgreSQL's default EXECUTE ACL. Their schema
  was already inaccessible to application roles; M7 additionally revokes their
  function privileges. Existing business regression suites pass after revocation.
- Audit events remain transactional, actor-bound and immutable to application users.
  Database administrator privileges are outside application RLS and must be controlled.
- Raw HTTP logging was a privacy risk for query strings and identifiers. M7 logs
  only generated request IDs, allowlisted method, matched route template, status and
  elapsed time. Generic errors omit exception text; transport access logs are disabled.
- CORS defaults closed; optional configuration rejects wildcard/unsafe origins.
  CORS never grants identity or business access. No credentialed cross-origin cookies.
- Frontend adds framing, MIME-sniffing and referrer protections. Existing server-action
  same-origin enforcement and HttpOnly/Lax/production Secure cookies are preserved.
- Upload policy remains closed: no endpoint or storage grant. Concrete format/size,
  retention and cleanup controls must be specified before M8 upload activation.

## Verification

- API: existing 127 tests plus 14 security cases pass (141 total). The full run
  initially exposed a test-enumeration assumption about lazy FastAPI routers;
  enumeration was corrected to use OpenAPI and all 14 security cases then passed.
  Tests exercise every domain route without authentication, CORS, private error/log
  canaries, unmatched-path redaction and disabled upload/AI routes.
- Database: all seven migrations and M2-M7 synthetic regression suites pass on
  disposable PGlite. Catalog assertions cover every table/RPC; developer/operator
  denial, owner audit read, audit mutation denial and profile mutation denial pass.
- Frontend: 60 tests across 15 files pass; lint, TypeScript, formatting, production
  build and client-secret scan pass. API Ruff lint/format checks pass.
- Two existing Starlette/httpx/AnyIO test deprecation warnings remain; no dependency
  upgrade was introduced in this security milestone.

## Limits and activation

Hosted M7 permission migration has not been applied by the agent. Production
provider logs, signup/rate limits, collaborator permissions, backups and storage
settings require deployment review in M7_SETUP.md. Local tests are not a claim of
production readiness or an external penetration test. No specification conflict
changes current business behavior; exact upload limits are deferred to M8 because
uploads remain unavailable. M8 was not started.

## Changed files

API: core/security.py, core/security_config.py, main.py, tests/test_security.py,
.env.example. Frontend: next.config.ts, tests/security.test.ts. Database:
202609270003_security.sql, tests/security.sql, tests/run-local.mjs. Documentation:
README.md, supabase/README.md, docs/README.md, docs/06_API_CONTRACT.md,
docs/08_SECURITY_PRIVACY.md, docs/20_M7_SECURITY.md, docs/M7_SETUP.md, this report.
