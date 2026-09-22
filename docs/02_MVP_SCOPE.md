# MVP Scope v1

## MVP success condition

Isna can complete a normal workday without re-entering the same
transaction information into Notes and then Excel for nightly recap.

## Core daily workflow

1.  Sign in.
2.  Confirm/select today's receiving account(s), including one default.
3.  Create customer orders quickly.
4.  System calculates expected IDR.
5.  Mark IDR as received when confirmed.
6.  Mark RMB as sent when fulfilled.
7.  Record team, ATM/card, RMB purchase/exchange, and other outflows.
8.  Review team balances and pending items.
9.  Open Daily Recap for customer count, CNY volume, Money In, Money
    Out, profit, and reconciliation information.

## MVP modules

### Dashboard

-   today's customer count
-   total CNY volume
-   Money In
-   Money Out
-   Daily Profit
-   pending/ready-to-send orders
-   recorded business position when configured

### Quick Order

Required interaction: - select/add customer - enter CNY - enter customer
rate - auto-calculate expected IDR - default today's receiving account -
save quickly

### Orders

-   search/filter orders
-   payment state
-   fulfillment state
-   order details
-   controlled edit with audit trail

### Customers

-   recurring customer master
-   quick customer creation
-   minimal data by default

### Accounts

-   account master
-   masked number
-   active/inactive
-   daily active accounts
-   daily default receiving account

### Teams

-   team master
-   RMB received
-   RMB distributed
-   optional order link
-   remaining RMB
-   fee based on actual handled volume

### ATM/Card Activity

-   account/card reference
-   actual CNY handled
-   configurable fee rate
-   calculated fee

### Expenses / Money Out

-   RMB purchase/exchange
-   exchange fee
-   team fee
-   ATM/card fee
-   other operational expense

### Daily Recap

-   customer count
-   total CNY
-   Money In
-   Money Out
-   profit
-   pending/unfinished orders
-   team RMB balances/reconciliation indicators

### Settings

-   default team fee
-   default ATM/card fee
-   relevant business settings

## AI status

AI screenshot extraction is MVP+ / Phase 2. The core product must remain
fully usable without AI.

## Explicitly out of MVP

-   RAG/vector database
-   LangChain/LangGraph unless later justified
-   chatbot for its own sake
-   forecasting
-   ML anomaly model before sufficient data exists
-   complex inventory accounting
-   FIFO/LIFO
-   native Android/iOS
-   advanced BI
-   Kafka/Redis/Kubernetes
-   automated money transfer
