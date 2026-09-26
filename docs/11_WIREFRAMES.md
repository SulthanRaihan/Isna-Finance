# Detailed Wireframes v1

These are functional low-fidelity wireframes for implementation. Visual
styling may evolve; information hierarchy and workflow should remain
consistent.

## Mobile navigation

``` text
┌────────────────────────────────┐
│          PAGE CONTENT          │
│                                │
│                                │
├────────────────────────────────┤
│  Home   Orders    ＋   Activity │
│                         More   │
└────────────────────────────────┘
```

The center `+` opens Quick Order.

------------------------------------------------------------------------

# W01 - Home / Dashboard

``` text
┌────────────────────────────────┐
│ Good evening                   │
│ 20 Sep 2026              [⌄]   │
│                                │
│ Receiving today                │
│ BCA ••••4821  Default      >   │
│ + 1 other active account       │
│                                │
│ ┌────────────┐ ┌────────────┐  │
│ │ Customers  │ │ Total CNY  │  │
│ │     17     │ │  ¥48,250   │  │
│ └────────────┘ └────────────┘  │
│                                │
│ Money In                       │
│ Rp xx.xxx.xxx                  │
│                                │
│ Money Out                      │
│ Rp xx.xxx.xxx                  │
│                                │
│ Profit                         │
│ Rp x.xxx.xxx                   │
│                                │
│ Orders needing attention       │
│ 2 Awaiting Payment         >   │
│ 3 Ready to Send           >   │
│                                │
│ Reconciliation                │
│ Team B remaining ¥1,000    >   │
│                                │
├────────────────────────────────┤
│ Home Orders    ＋ Activity More│
└────────────────────────────────┘
```

Primary goal: tell Isna what happened today and what still needs action.

------------------------------------------------------------------------

# W02 - Quick Order

``` text
┌────────────────────────────────┐
│ ← New Order                    │
│                                │
│ Customer                       │
│ [ Search customer...       ⌄ ] │
│                                │
│ CNY                            │
│ [ 10,000                     ] │
│                                │
│ Rate                           │
│ [ 2,647                      ] │
│                                │
│ Expected IDR                   │
│ Rp26,470,000                   │
│ calculated automatically       │
│                                │
│ Receiving account              │
│ [ BCA ••••4821   Default   ⌄ ] │
│                                │
│ Note (optional)                │
│ [                            ] │
│                                │
│ [        Save Order          ] │
│                                │
│ Phase 2: Import from Chat 📷   │
└────────────────────────────────┘
```

UX requirements: - customer search prioritizes recent/recurring
customers - account is prefilled - numeric keyboard on mobile - expected
IDR updates immediately as preview - backend recalculates on save - save
should be reachable without excessive scrolling

------------------------------------------------------------------------

# W03 - Order Saved / Fast Actions

``` text
┌────────────────────────────────┐
│ ✓ Order created                │
│                                │
│ Gaby                           │
│ ¥10,000 × 2,647                │
│ Rp26,470,000                   │
│                                │
│ Payment                        │
│ ○ Awaiting IDR                 │
│ [ Mark IDR Received ]          │
│                                │
│ RMB                            │
│ ○ Not sent                     │
│ [ Mark RMB Sent ]              │
│                                │
│ [ + Add Another Order ]        │
│ [ View Order ]                 │
└────────────────────────────────┘
```

This supports rapid consecutive entry.

------------------------------------------------------------------------

# W04 - Orders

``` text
┌────────────────────────────────┐
│ Orders                         │
│ [ Search...                  ] │
│                                │
│ All | Awaiting | Ready | Done  │
│                                │
│ Gaby                           │
│ ¥10,000  Rp26,470,000          │
│ READY TO SEND              >   │
│                                │
│ Andrew                         │
│ ¥3,000   Rp7,944,000           │
│ AWAITING PAYMENT           >   │
│                                │
│ David                          │
│ ¥10,000  Rp26,470,000          │
│ COMPLETED                  >   │
├────────────────────────────────┤
│ Home Orders    ＋ Activity More│
└────────────────────────────────┘
```

Use status text + icon; do not rely on color alone.

------------------------------------------------------------------------

# W05 - Order Detail

``` text
┌────────────────────────────────┐
│ ← Order Detail          [•••]  │
│                                │
│ Gaby                           │
│ ¥10,000                        │
│ Rate 2,647                     │
│ Expected IDR Rp26,470,000      │
│                                │
│ Receiving account              │
│ BCA ••••4821                   │
│                                │
│ Payment                        │
│ ✓ IDR received 10:30           │
│                                │
│ Fulfillment                    │
│ ○ RMB not sent                 │
│ [ Mark RMB Sent ]              │
│                                │
│ Team allocation                │
│ Team B  ¥10,000            >   │
│                                │
│ History                        │
│ Created 09:12                  │
│ Payment marked 10:30           │
└────────────────────────────────┘
```

`•••` may expose controlled edit/history, not destructive direct delete.

------------------------------------------------------------------------

# W06 - Activity Hub

``` text
┌────────────────────────────────┐
│ Activity                       │
│                                │
│ [ Team Activity             > ]│
│ RMB handled, fee, ledger       │
│                                │
│ [ ATM / Card                > ]│
│ Actual CNY and fee             │
│                                │
│ [ RMB Purchase / Exchange   > ]│
│ CNY, rate, IDR cost            │
│                                │
│ [ Other Expense             > ]│
│ Operational outflow            │
│                                │
│ Today's Money Out              │
│ Rp xx.xxx.xxx                  │
└────────────────────────────────┘
```

------------------------------------------------------------------------

# W07 - Team Detail

``` text
┌────────────────────────────────┐
│ ← Team B                       │
│ 20 Sep 2026                    │
│                                │
│ Received        ¥13,000        │
│ Distributed     ¥12,000        │
│ Remaining        ¥1,000        │
│                                │
│ Actual handled                 │
│ [ 13,000                    ]  │
│ Fee rate                       │
│ [ 2 / CNY                   ]  │
│ Fee             Rp26,000       │
│                                │
│ Movements                      │
│ +13,000 Received               │
│ -10,000 David                  │
│ -1,000  Nopi                   │
│ -1,000  Sugik                  │
│                                │
│ [ + Add Movement ]             │
│ [ Save Daily Activity ]        │
└────────────────────────────────┘
```

Saving activity leaves the fee unpaid. Explicit payment confirmation creates
the single canonical outflow on the actual payment date.

------------------------------------------------------------------------

# W08 - ATM / Card Activity

``` text
┌────────────────────────────────┐
│ ← ATM / Card Activity          │
│                                │
│ Account/Card                   │
│ [ BCA ••••4821             ⌄ ] │
│                                │
│ Actual CNY handled             │
│ [ 5,600                     ]  │
│                                │
│ Fee / CNY                      │
│ [ 1.7                       ]  │
│                                │
│ Calculated fee                 │
│ Rp9,520                        │
│                                │
│ [ Save Activity ]              │
└────────────────────────────────┘
```

------------------------------------------------------------------------

ATM Save Activity leaves fee unpaid. Show a separate payment confirmation with
actual payment date. Paid views show the original activity snapshot and current
canonical posting (including void/correction status).

# W09 - Add Money Out

``` text
┌────────────────────────────────┐
│ ← Add Money Out                │
│                                │
│ Type                           │
│ [ RMB Purchase / Exchange  ⌄ ] │
│                                │
│ CNY                            │
│ [ 42,090                    ]  │
│ Rate                           │
│ [ 2,618.45                  ]  │
│                                │
│ Calculated IDR                 │
│ Rp110,210,560.50               │
│                                │
│ Description                    │
│ [ RMB purchase              ]  │
│                                │
│ [ Save ]                       │
└────────────────────────────────┘
```

For `Exchange Fee` and `Other Expense`, show actual direct IDR amount instead of CNY/rate.

------------------------------------------------------------------------

# W10 - Daily Recap

``` text
┌────────────────────────────────┐
│ ← Daily Recap                  │
│ 20 Sep 2026              [⌄]   │
│                                │
│ 17 customers   ¥48,250 CNY     │
│                                │
│ MONEY IN                       │
│ Customer orders                │
│ Rp xxx.xxx.xxx                 │
│                                │
│ MONEY OUT                      │
│ RMB Purchase    Rp ...         │
│ Team Fees       Rp ...         │
│ ATM Fees        Rp ...         │
│ Other           Rp ...         │
│ -----------------------------  │
│ Total Out        Rp ...        │
│                                │
│ PROFIT                         │
│ Rp x.xxx.xxx                   │
│                                │
│ TEAM BALANCES                  │
│ Team A ¥0                      │
│ Team B ¥1,000  ⚠              │
│ Team C ¥0                      │
│                                │
│ UNFINISHED                     │
│ 2 awaiting payment             │
│ 3 ready to send                │
└────────────────────────────────┘
```

This is the primary replacement for nightly Excel recap.

------------------------------------------------------------------------

# W11 - Accounts / Today's Accounts

``` text
┌────────────────────────────────┐
│ ← Receiving Accounts           │
│                                │
│ Today                          │
│ ✓ BCA ••••4821       DEFAULT   │
│ ✓ SeaBank ••••7721             │
│                                │
│ [ Change Today's Accounts ]    │
│                                │
│ All Accounts                   │
│ BCA ••••4821              >    │
│ SeaBank ••••7721          >    │
│ BNI ••••2910              >    │
│ ...                            │
│                                │
│ [ + Add Account ]              │
└────────────────────────────────┘
```

------------------------------------------------------------------------

# W12 - Customers

``` text
┌────────────────────────────────┐
│ ← Customers                    │
│ [ Search customer...         ] │
│                                │
│ Recent                         │
│ Gaby                       >   │
│ Andrew                     >   │
│ David                      >   │
│                                │
│ All                            │
│ ...                            │
│                                │
│ [ + Add Customer ]             │
└────────────────────────────────┘
```

Keep customer profile intentionally minimal.

------------------------------------------------------------------------

# W13 - AI Import Preview (Phase 2)

``` text
┌────────────────────────────────┐
│ ← Import from Chat             │
│                                │
│ [ screenshot preview ]         │
│                                │
│ AI found                       │
│ Customer  Gaby        94%      │
│ CNY       10,000      99%      │
│ Rate      2,647       98%      │
│                                │
│ Please verify before saving.   │
│                                │
│ [ Edit Fields ]                │
│ [ Confirm & Create Order ]     │
└────────────────────────────────┘
```

The confirmation action calls the ordinary order endpoint. AI never
directly writes to the ledger.

------------------------------------------------------------------------

# Desktop behavior

Desktop uses the same information architecture with a left sidebar and
wider cards/tables. Do not create a separate desktop workflow.

# Accessibility / usability

-   large touch targets
-   numeric keypad for CNY/rate/fee
-   status not communicated by color alone
-   currency labels always visible
-   confirmation for material financial actions
-   loading/success/error states
-   preserve entered form values after recoverable API errors

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
See 17_M4_TEAM_ACTIVITY.md for the implementation contract.

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
See 18_M5_MONEY_OUT.md for schema/API and verification details.
