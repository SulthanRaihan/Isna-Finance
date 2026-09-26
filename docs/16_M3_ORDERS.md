# M3 Orders contract

Read documents 01-06, 08-13 and the M2 contract first. Only manual orders,
order search/detail, payment/fulfillment actions and audit are implemented.
No team posting, outflows, dashboard totals, AI or realized correction workflow.


## M3 frozen order rules (2026-09-25)

- Authoritative persisted IDR calculations use Python Decimal, ROUND_HALF_UP,
  quantized to two decimal places (100.005 becomes 100.01). Frontend values are
  previews only. Money In still uses the business-local date of idr_received_at.
- customer_id, business_date, cny_amount, customer_rate and receiving_account_id
  can change only while payment_status=awaiting AND fulfillment_status=pending.
  Either received payment OR sent RMB locks all five fields. note remains editable.
  All permitted changes are audited. Realized corrections require a future explicit
  correction/void workflow; M3 never silently changes financial history.
- An order account must be active AND assigned in daily_account_assignments for
  the order business_date. The daily default is only a preselection; an explicit
  override may choose another assigned active account. Order creation never
  creates or changes daily assignments.

M3 implementation details and error behavior: see 16_M3_ORDERS.md.

## API implementation contract

All routes are owner-only. JSON money is decimal strings. Create requires an
Idempotency-Key (1..128 safe ASCII characters); a key is scoped to owner and
operation. Same key and normalized payload returns the original result without
another audit/write; different payload returns 409 IDEMPOTENCY_CONFLICT.
Create, update and audit commit together. Browser retains the key and payload
across uncertain network results; never automatically retries a financial write.

POST /orders accepts the six specified create fields plus nullable note, never
expected_idr, role or created_by. Amount/rate bounds follow numeric(18,2)/(18,6).
An IDR result outside numeric(20,2) is rejected. Python calculates at sufficient
precision before rounding once; PostgreSQL checks the same invariant defensively.

PATCH /orders/{id} accepts any nonempty subset of the five editable fields and
note. Backend reads the current version; atomic update rejects stale versions
with 409 STALE_ORDER. Locked fields with actual value changes return 409
ORDER_LOCKED. Unchanged values do not rewrite financial history. Note-only edits
do not require old accounts to remain active/assigned. No-op writes add no audit.

Receive-payment and mark-sent require offset-aware received_at/sent_at and an
Idempotency-Key. States are independent: sent before received is allowed and
shown with a warning. A repeated identical transition timestamp is a no-op;
a different timestamp after confirmation returns 409 STATE_CONFLICT. There are
no reverse-state or timestamp correction endpoints. The user explicitly confirms
the actual event time (shown in the configured business timezone).

GET /orders supports date, date_from, date_to, customer_id, receiving_account_id,
payment_status, fulfillment_status, q (customer name), limit 1..100 and offset.
GET /orders/{id} includes customer, masked account, audit and an empty linked
team-movements list until M4. Derived ui_status includes sent_awaiting_payment;
Money In date is null until received, then derives only from idr_received_at.
GET /audit/orders/{id} returns append-only order audit history.

## Database boundaries

Orders, audit_logs and idempotency_keys enable and force RLS. Owner SELECT only;
no direct authenticated table mutation. Checked security-definer RPCs perform
writes with empty search_path, owner validation, invariant checks and audit.
No service-role credential. Account/assignment checks share M2's transaction lock
so assignment replacement/deactivation cannot race validation. Existing orders
remain intact when assignments are later changed. Foreign keys restrict deletion.
Idempotency locking serializes the same owner/operation/key before order locking.

## Verification plan

Synthetic automated checks cover rounding/overflow, strict decimal inputs,
received-date recognition across midnight, status independence, locked edits,
assigned-account validation, atomic audit/idempotency, denial and stale versions.
Hosted synthetic acceptance started after the user applied the M3 migration.
See M3_REPORT.md for verified results and outstanding hosted checks.
