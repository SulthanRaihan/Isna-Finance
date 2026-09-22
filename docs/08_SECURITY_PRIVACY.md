# Security & Supabase RLS Design v1

## Security model

The application handles financial/business data. Security is a product
requirement, not a later deployment task.

## Trust boundaries

``` text
Browser / Next.js
      |
      | Supabase user session
      v
FastAPI
      |
      | validates identity + authorization
      v
Supabase PostgreSQL

Browser must never receive:
- Supabase service-role key
- AI provider secret
- backend-only secrets
```

## Roles

MVP roles: - `owner`: Isna; full normal business access - `operator`:
optional future operational staff - `developer`: application role only;
must NOT automatically grant production financial-data access

For an initial single-user deployment, owner-only policies are
acceptable and simpler.

## Authentication

-   Supabase Auth.
-   FastAPI verifies authenticated identity/token.
-   Sensitive writes require authenticated user.
-   Do not build password storage/authentication manually.

## Authorization

Authorization is enforced server-side even if the UI hides controls.

Recommended MVP: - owner: CRUD business master data; create/update
financial operations; view recaps/audit as allowed - operator later:
limited operational actions - developer: no implicit production-data
privilege

## RLS strategy

Enable RLS on all application tables before production.

For owner-only MVP, policies may permit authenticated owner access to
business rows while denying anonymous access.

Tables requiring RLS include: - profiles - customers - accounts -
daily_account_assignments - orders - teams - team_movements -
team_daily_activities - atm_card_activities - financial_outflows -
business_balance_openings - audit_logs - idempotency_keys

## Important backend architecture rule

If FastAPI uses a Supabase service-role credential for server-side
operations, RLS may be bypassed. Therefore: - keep service-role key only
in backend environment variables - FastAPI must perform explicit
authorization before privileged DB operations - never expose
service-role key to Next.js client/browser - prefer
user-context/RLS-compatible access where practical - document every
service-role use

## Account-number privacy

Default MVP should store only: - account label - bank - last four digits

Do not store a full account number unless the product actually needs it.

If full number is later required: - protect/encrypt appropriately -
restrict read access - mask by default - never log it - never include it
in AI prompts unless essential

## Screenshots

-   validate MIME/type and size
-   generate unpredictable object paths
-   private storage bucket
-   signed/authorized access only
-   short retention by default for AI extraction
-   no public bucket for customer chats
-   delete temporary screenshots after processing when retention is
    unnecessary

## Logging

Do log: - request ID - endpoint - success/error category - timing -
actor ID where appropriate - audit events

Do not log: - full account numbers - raw auth tokens - AI API keys -
entire screenshots - unnecessary customer chat contents - full sensitive
financial payloads

## Audit

Material financial changes create append-only audit records: - actor -
entity - action - before/after - timestamp

Application users should not be able to casually edit/delete audit
history.

## Input validation

All write payloads are validated by FastAPI/Pydantic. Database
constraints provide a second line of defense.

Never trust: - browser-calculated money - hidden form values - AI
output - client-supplied role - client-supplied `created_by`

## CSRF/XSS/injection

-   use framework-safe rendering
-   do not render unsanitized user/AI HTML
-   parameterized ORM/query access
-   apply appropriate same-site/session protections
-   restrict CORS to expected origins
-   validate uploads

## Secrets

Vercel environment variables: - Supabase server credentials as
required - AI provider key - backend secret/config

Never commit `.env` files containing real secrets.

Provide `.env.example` with names only.

## Backups / recovery

Before real production use: - verify Supabase backup/recovery options
for the selected plan - document export/recovery procedure - test that
business data can be exported

Do not claim backup guarantees beyond the actual selected service plan.

## Rate limiting / abuse

At minimum rate-limit: - authentication-sensitive endpoints where
applicable - AI extraction - file uploads - high-cost endpoints

## AI-specific security

-   screenshots are untrusted input
-   prompt injection in screenshots cannot trigger actions
-   AI endpoint cannot write financial records
-   validate structured output
-   minimize data sent to provider
-   document provider retention/privacy configuration before production

## Production privacy checklist

-   synthetic data removed from production seed path
-   no real data in Git history
-   RLS enabled/tested
-   secrets only in environment
-   private screenshot bucket
-   account masking tested
-   audit tested
-   developer access reviewed
-   AI provider privacy settings reviewed

## M1 owner-only implementation

See `14_M1_AUTH.md` for the approved email/password, single-owner access rules,
profile provisioning, initial RLS, and `/api/v1/me` contract.
