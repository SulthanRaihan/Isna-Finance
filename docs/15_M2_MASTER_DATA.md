# M2 master data implementation contract

Read together with documents 01, 03, 05, 06, 08, 09, 10 and 11.
Only customers, masked accounts, teams and daily account choices are in scope.
Orders, ledger movements, fees posting and dashboard totals remain later milestones.

## API and persistence

Owner-only endpoints: GET/POST/PATCH customers and accounts; GET/POST teams;
GET business-context; GET/PUT daily-accounts. Lists return {items, limit, offset}
and accept q, active, limit (1..100), offset. Customers permit duplicate names;
teams retain the blueprint's unique name constraint. Names/labels are trimmed,
nonempty and limited to 120 characters, notes to 2000. These are input limits,
not financial rules. Country codes are two uppercase letters; last4 is optional
and exactly four digits. Full account numbers are not accepted or stored.
Team default_fee_rate is a nonnegative decimal string with at most six decimal
places, default "2.000000". No fee is posted in M2.

Next.js forwards requests server-side to FastAPI using the current session token;
tokens never enter client component props. API validates owner and Pydantic inputs;
Supabase calls use the caller token with RLS, never a service-role key.

Daily replacement is one database transaction with serialization against account
deactivation. Account deactivation uses the approved rule in document 01 and
returns ACCOUNT_ASSIGNED/409 with conflicting_assignments. Direct authenticated
table writes must enforce the same rule through database triggers.

A private database setting holds the business timezone, initially Asia/Jakarta.
API BUSINESS_TIMEZONE must match it; mismatches return a configuration error,
not inconsistent dates. Change both settings together through an explicit admin
configuration change. GET business-context returns business_date and timezone
from the database clock. The browser never invents today's business date.

Empty daily choices and no default are allowed (at most one, not exactly one).
Selecting a default never automatically activates a different account. A daily
PUT changes only the explicitly selected date. There is no destructive account
API; historical assignments are not modified by account activation changes.

## Acceptance

Synthetic tests: anonymous denial, owner CRUD, masked fields, decimal rejection,
invalid/default/inactive assignment rejection, conflict payload, atomic replacement,
and timezone mismatch. Database SQL tests must be run against a development project;
mock HTTP tests do not establish RLS or concurrency correctness.
