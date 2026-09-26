# M4 Team ledger and daily activity

## Scope

Owner-only team ledger, optional order reference, daily handled volume, fee
calculation and explicit fee payment. No M5 correction/void, ATM, manual outflows,
M6 dashboard or AI. No actual transfers are performed.

## M4 fee payment rule (approved 2026-09-26)

Activity business_date is the date the team activity occurred. Saving calculates
fee with Decimal ROUND_HALF_UP to two places and starts fee_status=unpaid; it
creates no financial_outflow and recognizes no Money Out. Explicit payment
confirmation supplies payment_date (the actual date money left). Payment atomically
marks the activity paid and creates exactly one canonical financial_outflows row:
category=team_fee, source_type=team_daily_activity, source_id=activity.id,
business_date=payment_date. Only this posted outflow contributes to Money Out.
Payment is idempotent and concurrent calls cannot create duplicate postings.
Once paid, team_id, business_date, actual_cny_handled and fee_rate are locked.
Later corrections require an explicit correction/void workflow, outside M4.

Ledger received/distributed amounts are positive. Adjustment amounts are signed,
as in financial engine F-08. Balance through a selected date is the cumulative
received minus distributed plus signed adjustments through that date; daily
movement totals are separately labeled. Order links are references only: they do
not modify order payment/fulfillment and movements never generate fees.

One activity per (team_id,business_date). Actual volume is explicit and independent
of ledger movements. Fee rate is snapshotted; later team defaults do not rewrite
it. Unpaid edits are explicit and audited; paid financial edits are rejected.
No movement edit/delete or void endpoint is included in M4.

## Schema and API

team_movements follows document 10. team_daily_activities adds fee_status
(unpaid/paid, default unpaid), payment_date nullable and updated_at version.
financial_outflows uses document 10, with unique (source_type,source_id) for linked
records. M4 only writes team_fee. All three tables force RLS, owner SELECT only;
checked security-definer RPCs handle mutations and audit atomically, empty search_path.
Separate team request keys avoid changing M3's order-specific foreign key.

POST /team-movements: team_id,business_date,movement_type,cny_amount,order_id?,note?.
GET /teams/{id}/ledger?date=: cumulative balance, selected-day totals, paginated
movements. GET /team-movements?order_id= supports order detail linkage.
POST /team-activities: team_id,business_date,actual_cny_handled,fee_rate.
GET /team-activities?team_id=&date=: list with pagination.
PATCH /team-activities/{id}: full unpaid activity fields plus expected updated_at;
reject stale version or paid activity. Recalculate server-side.
POST /team-activities/{id}/pay: payment_date and expected updated_at version, explicit confirmation in UI.
Reject stale unpaid versions so payment cannot confirm an unseen fee amount.
All writes require Idempotency-Key. Same key/payload replays original response;
different payload conflicts. Repeating payment with a new key and same date is a
no-op; a changed paid date conflicts. Row lock and unique source constrain races.
Fee amounts are recalculated using Decimal on API and defensively checked by SQL.
JSON monetary amounts, including audit/replay payloads, are decimal strings.
No hard delete, implicit assignment creation, or order state changes.

## Verification

Use synthetic isolated tests for ledger arithmetic, unpaid fee nonrecognition,
payment date separation, rounding, duplicate/retry protection, paid locks, stale
writes, owner denial and direct-table denial. Hosted activation is a separate step;
never run fixture SQL in the provisioned project. M3 acceptance remains partial.

Retry keys remain in the mounted browser form. After reload/close, inspect current
records before re-entry. The initial M4 uniqueness constraint permits at most one
linked outflow total (stronger than one posted row); future void/reposting requires
an explicit reviewed migration/workflow. It cannot be bypassed in M4.
