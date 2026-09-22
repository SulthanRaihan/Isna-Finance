# Isna CNY-IDR Operations System

> Source of truth for Codex and implementation work.

## Purpose

Build a mobile-first application that replaces the current Notes -\>
Excel -\> nightly recap workflow for Isna's CNY/IDR operation. The
application does not transfer money. It records orders, operational
financial movements, team/ATM activity, reconciliation information, and
daily summaries.

## Frozen stack v1

-   Next.js + TypeScript
-   Tailwind CSS + shadcn/ui
-   FastAPI + Python + Pydantic
-   Supabase PostgreSQL + Auth + Storage
-   Vercel
-   vision-capable LLM API for Phase 2
-   Python/pandas/scikit-learn for AI evaluation when justified
-   no Docker

## Required reading order for Codex

1.  `01_BUSINESS_RULES.md`
2.  `02_MVP_SCOPE.md`
3.  `03_DATA_MODEL.md`
4.  `04_UX_INFORMATION_ARCHITECTURE.md`
5.  `05_FINANCIAL_ENGINE.md`
6.  `10_POSTGRES_SCHEMA.md`
7.  `06_API_CONTRACT.md`
8.  `11_WIREFRAMES.md`
9.  `07_AI_SYSTEM_DESIGN.md` when AI work begins
10. `08_SECURITY_PRIVACY.md`
11. `09_IMPLEMENTATION_PLAN.md`
12. `12_CODEX_PROMPTS.md`
13. `13_VISUAL_DESIGN_SYSTEM.md`

## Non-negotiable rules

-   Do not invent business rules.
-   Existing Excel workflow is the business reference for v1.
-   Financial calculations are deterministic and never delegated to an
    LLM.
-   Use decimal/numeric money types, never binary floating point.
-   AI can create drafts/suggestions but cannot silently post financial
    records.
-   AI-extracted transactions require user validation and confirmation.
-   Use synthetic data in repository, tests, demos, prompts, and AI
    evaluation.
-   Keep payment state separate from RMB fulfillment state.
-   Recorded business balance is not actual personal bank balance.
-   No unnecessary infrastructure or speculative dependencies.
-   No Docker for v1.

## Change control

If implementation needs conflict with these documents, stop and report
the conflict. Update the specification before changing
financial/business behavior.

## Current status

System design v1 now includes: - business rules - MVP scope - logical
data model - UX information architecture - financial engine - physical
PostgreSQL schema - API contract - functional wireframes - AI system
design - security/RLS design - implementation milestones - Codex
milestone prompts

Visual direction is defined in `13_VISUAL_DESIGN_SYSTEM.md`.

The approved business-date clarification is recorded consistently in documents
01, 03, 05, 06, and 10. Money In always follows the business-local date of
`idr_received_at`, never the operational order date.
