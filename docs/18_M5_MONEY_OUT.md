# M5 ATM/Card and manual Money Out


## M5 frozen rules (2026-09-26)

ATM/card activity saves a calculated fee with fee_status=unpaid and no Money Out.
Explicit fee payment supplies the actual payment_date and atomically creates one
canonical atm_card_fee outflow on that date. Payment is idempotent.
Void requires a reason, retains the original record/audit, changes status to
voided and excludes that record from Money Out. Void is accounting invalidation,
not a real-world refund. Correction atomically voids the old posting and creates
a linked replacement, preserving the full chain and audit; any failure rolls back
all changes. Only the current posted replacement contributes to Money Out.
Applies to team fees, ATM/card fees, RMB purchases, exchange fees and other manual
outflows. M3 realized orders stay locked; no order correction is introduced.
Exchange fee uses actual user-entered IDR. Only RMB purchase uses CNY * rate.
The implementation contract follows below.

## Contract

Owner-only, Decimal HALF_UP two-place IDR; JSON decimal strings; no hard deletion.
ATM creation fields: account_id nullable, business_date (activity date),
actual_cny_handled positive, fee_rate nonnegative, note nullable. Unpaid edits use
these fields plus expected updated_at. Paid activity snapshots remain locked.
POST /atm-activities, PATCH /atm-activities/{id}, GET /atm-activities (date/account
filters, pagination), POST /atm-activities/{id}/pay (payment_date, updated_at).
The account reference is optional; no receiving daily assignment is created.

POST /outflows accepts business_date (actual money-out date), category,
description and category-specific fields: rmb_purchase uses cny_amount and
rate_or_fee; exchange_fee/other use amount_idr. Manual creation cannot use team_fee
or atm_card_fee; those always originate from their activity payment.
GET /outflows filters date/status/category/source with pagination; posted defaults.
GET /outflows/{id} returns the posting, complete linked correction chain and audit.
POST /outflows/{id}/void: reason, updated_at. POST /outflows/{id}/correct: reason,
updated_at, business_date, description and category-specific values in one flat body.
Correction preserves category and source identity. Fee replacements use CNY * fee
rate (nonnegative rate); RMB purchase requires positive rate. No cross-category
reclassification or real refunds are introduced. Correction of a voided/older
posting conflicts; operate on the current posted replacement only.

Correction snapshots are stored on the replacement outflow; original paid activity
inputs/payment date remain historical evidence and are never silently rewritten.
Activity views distinguish original fee snapshot from current canonical posting
and show void/correction status. A void never resets an activity to unpaid and
cannot enable a second payment. Corrected dates are actual dates of money leaving,
not today's correction date. Ordinary team/ATM payment retries never recreate a
voided fee. No effect on orders or team movement balances.

## Database

Add atm_card_activities and money_out_request_keys with forced RLS and owner SELECT
only. Financial mutations use checked security-definer RPCs with empty search_path.
financial_outflows adds replaces_id (unique nullable FK to prior posting),
void_reason, voided_at. Existing rows remain unchanged. Replace M4's full source
uniqueness with partial uniqueness for posted sources, allowing preserved voided
ancestors. One successor per posting plus immutable linkage prevents branching.
Checked mutation locks serialize corrections/voids; transactional rollback covers
posting, audit and idempotency key. Existing M4 pay lookup selects the current
posting (or latest voided record); paid source remains paid and cannot repost.
All writes require Idempotency-Key; same key/payload replays, changed payload
conflicts. Corrections/voids require the current version. Retry UI freezes payload
and key on uncertain results; after reload inspect records before re-entry.

## Required tests (written before implementation)

ATM 5600 * 1.7 = 9520; unpaid activity produces zero outflows; explicit payment
uses its separate date; duplicate payment does not duplicate audit or posting.
All five categories support atomic correction, chain retention, one posted source,
required void reason and idempotency. Invalid replacement rolls back original
void, audit and key. Paid activities/order fields stay unchanged. Voided rows are
excluded from posted listings. Owner allowed; anonymous/developer/direct writes
denied. M6 dashboard totals and production readiness are out of scope.

## Implementation details

- Migration: `supabase/migrations/202609270001_money_out.sql`, after M1-M4.
- API write payloads reject unknown fields. Nonnegative direct IDR accepts at most
  two fractional digits; CNY is positive with two places; rates have six places.
  IDR is under 10^18, CNY under 10^16, rate under 10^12, matching numeric columns.
- Formula requests do not accept client amount_idr. FastAPI computes it with Decimal;
  SQL checks the exact rounded product again before accepting the transaction.
- API response decimals are strings. List endpoints default to limit=20, maximum
  100, offset=0. Source filters are source_type and source_id. GET date means
  activity date for ATM and actual payment date for outflows.
- ATM GET and team activity GET include current_outflow (null while unpaid).
  A bounded owner-only current_fee_outflows RPC returns the latest canonical
  posting per source without truncating long correction chains.
- POST/PATCH ATM responses: activity and outflow (null before payment). Manual
  create/void/correct return the resulting outflow. Detail returns outflow, chain
  in original-to-latest order, and audit events for all chain members.
- POST/PATCH all use Idempotency-Key. Database conflicts map to 409 (stale version,
  state lock, key reuse); invalid inputs 422; missing records 404; non-owner denied.
- Routes: /atm, /outflows, /outflows/[id], linked from Activity and More. No M6 totals.
- Request-key replay returns the original operation response snapshot. Refresh the
  list/detail to inspect current state after later corrections. A new payment key
  for an already paid source reads the latest posting and never creates another.
