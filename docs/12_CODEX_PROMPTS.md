# Codex Milestone Prompts

Use these prompts only after placing the specification files in the
repository `docs/` directory.

## Global prefix for every Codex task

> Read `docs/README.md` and every document it requires for this
> milestone before editing code. Treat the documentation as the source
> of truth. Do not invent business rules or silently change financial
> behavior. Use synthetic data only. If specifications conflict or a
> required behavior is undefined, stop and report the conflict with the
> exact files/sections involved. Do not implement later milestones
> unless explicitly requested.

## M0 prompt

Implement **M0 Repository Foundation** from
`docs/09_IMPLEMENTATION_PLAN.md`.

Use the frozen stack: - Next.js + TypeScript - Tailwind + shadcn/ui -
FastAPI + Python + Pydantic - Supabase - Vercel-compatible deployment -
no Docker

Create the repository structure described in the implementation plan,
basic frontend shell, FastAPI health endpoint, test/lint configuration,
`.env.example`, and developer setup instructions. Do not implement
business features yet.

At completion, report: 1. files created/changed 2. commands to run
frontend/backend/tests 3. assumptions 4. unresolved specification
conflicts 5. what remains for M1

## M1 prompt

Implement **M1 Supabase Auth + profiles** only.

Read security/RLS specifications first. Never expose service-role
credentials to the browser. Add automated tests for anonymous denial and
authenticated owner access where practical. Do not implement orders or
financial features.

## M2 prompt

Implement **M2 Master Data** only: customers, accounts, teams, and daily
active/default receiving accounts.

Follow the PostgreSQL schema, API contract, and wireframes. Account
numbers must be masked in normal UI. Use synthetic seed data.

## M3 prompt

Implement **M3 Orders** only.

Quick Order is the highest-priority UX. The FastAPI backend must
recalculate expected IDR with Decimal. Implement payment and fulfillment
as separate states, audit material changes, and idempotent order
creation. Do not implement AI extraction yet.

## M4 prompt

Implement **M4 Team Ledger + Daily Team Activity** only.

Keep team movements separate from fee calculation. Daily team activity
creates exactly one canonical financial outflow. Add tests proving there
is no double counting.

## M5 prompt

Implement **M5 ATM/Card + Money Out** only.

Use canonical `financial_outflows`. Implement deterministic fee/purchase
calculations and void behavior. Add all financial test vectors from
`05_FINANCIAL_ENGINE.md`.

## M6 prompt

Implement **M6 Dashboard + Daily Recap** only.

Dashboard calculations must read canonical backend/database results and
must not duplicate financial formulas in the UI. Match the functional
wireframes and make the experience mobile-first.

## M7 prompt

Implement **M7 Security Hardening** only.

Review RLS, authorization, CORS, logging redaction, audit permissions,
and upload-policy foundations. Produce a short security verification
report.

## M8 prompt

Implement **M8 AI Screenshot Extraction** only.

The AI endpoint returns a draft and must have no ability to post an
order. Use a provider adapter, structured output, Pydantic validation,
customer matching, confidence/warnings, private temporary uploads, and a
human confirmation screen. Confirmation must call the normal order
endpoint.

## M9 prompt

Implement **M9 AI Evaluation** only.

Create a synthetic/anonymized evaluation dataset and automated
evaluation harness. Report field accuracy, customer matching, CNY/rate
exact match, full-record exact match, missing/hallucinated fields,
latency, and cost. Do not include real customer chats.

## M10 prompt

Implement **M10 Production Readiness** only.

Run critical tests, responsive/accessibility QA, migration review,
privacy/security checklist, deployment configuration, and
recovery/export documentation. Do not claim production readiness if any
critical financial/security test is failing.
