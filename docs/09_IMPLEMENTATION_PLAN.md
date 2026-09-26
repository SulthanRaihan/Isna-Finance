# Implementation Plan v1

Codex must implement one milestone at a time. Do not build later
milestones speculatively.

## M0 - Repository foundation

Deliver: - monorepo or clear single repository structure - Next.js
TypeScript frontend - FastAPI backend - shared documentation -
lint/format/test configuration - `.env.example` - synthetic development
data only

Exit criteria: - both apps run - health check works - no production
secret committed

## M1 - Supabase Auth + profiles

Deliver: - Supabase Auth integration - protected application shell -
FastAPI token validation - owner profile - initial RLS policies

Tests: - anonymous user denied - authenticated owner allowed -
service-role secret absent from browser

## M2 - Master data

Deliver: - customers - accounts - teams - daily active/default accounts

UX: - customer search/add - masked accounts - choose today's default
account

Exit criteria: - Quick Order prerequisites can be configured without
SQL/manual DB editing

## M3 - Orders

Deliver: - Quick Order - order list - order detail - payment received
action - RMB sent action - audit events - idempotent create

Tests: - expected IDR recalculated server-side - status transitions -
received timestamp drives Money In - duplicate retry protection

## M4 - Team ledger + daily team activity

Deliver: - team movements - optional order link - team balance - actual
daily handled CNY - unpaid team fee - explicit payment confirmation with actual
payment date - exactly one canonical outflow on payment

Tests: - ledger math - fee math - no double-counting

## M5 - ATM/Card + manual Money Out

Deliver: - ATM/card activity - ATM fee posting - RMB purchase/exchange -
exchange fee/other expense - void/correction behavior

Tests: - `5600 * 1.7 = 9520` - canonical posting uniqueness - voided
item excluded

## M6 - Dashboard + Daily Recap

Deliver: - daily metrics - pending states - category breakdown -
profit - team balances - warnings - recorded business position when
opening position exists

Exit criteria: - a normal day can be operated without nightly re-entry
into Excel

## M7 - Security hardening

Deliver: - complete RLS review - CORS/config - upload policy
foundation - audit permissions - logging redaction - production privacy
checklist

## M8 - AI screenshot extraction

Deliver: - private temporary upload - AI provider adapter - structured
extraction - Pydantic validation - customer matching -
confidence/warnings - preview/edit/confirm UI - deletion/retention
behavior - AI endpoint cannot create order

Manual Quick Order must still work if AI is unavailable.

## M9 - AI evaluation

Deliver: - 100+ synthetic/anonymized evaluation examples - automated
evaluation script - field metrics - record exact match -
hallucination/missing-field analysis - latency/cost report - model
comparison if useful

## M10 - Production readiness

Deliver: - responsive QA - accessibility pass - critical Playwright
flows - backend pytest suite - database migration review - deployment
configuration - backup/export procedure - user acceptance test with
synthetic data first - production launch checklist

## Definition of Done for each milestone

-   relevant docs read before implementation
-   code matches current spec
-   tests pass
-   no sensitive real data added
-   no unresolved TODO that changes financial behavior
-   schema/API changes update docs
-   Codex reports spec conflicts instead of guessing

## Suggested repository structure

``` text
/
├── README.md
├── docs/
│   ├── README.md
│   ├── 01_BUSINESS_RULES.md
│   ├── ...
│   └── 11_WIREFRAMES.md
│
├── web/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
│
├── api/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── financial/
│   │   │   └── ai/
│   │   └── repositories/
│   └── tests/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── ai-evaluation/
│   ├── README.md
│   ├── synthetic_dataset/
│   ├── evaluation/
│   └── reports/
│
└── .env.example
```

No Docker is required for v1.

## Codex first-build instruction

Do not ask Codex to "build the entire app." Start with M0 only. Review,
then authorize M1, and continue milestone by milestone.
