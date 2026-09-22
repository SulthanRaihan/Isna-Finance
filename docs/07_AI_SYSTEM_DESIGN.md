# AI System Design v1

## Objective

Reduce repeated manual entry from customer chats without allowing
probabilistic AI output to become authoritative financial data.

## Phase 2 primary use case

`Chat screenshot -> structured order draft -> human verification -> normal order API`

AI is an input assistant, not a financial ledger engine.

## Architecture

``` text
Mobile/Web
   |
   | screenshot
   v
Next.js UI
   |
   | authenticated request
   v
FastAPI /ai/extract-order
   |
   +--> validate file/type/size
   +--> privacy preprocessing when applicable
   |
   v
AI Provider Adapter
   |
   v
Vision-capable LLM
   |
   | structured response
   v
Pydantic Validation
   |
   +--> normalization
   +--> customer candidate matching
   +--> confidence/warnings
   |
   v
DRAFT RESPONSE ONLY
   |
   v
User verifies/edits
   |
   v
POST /orders
   |
   v
Normal deterministic business logic
```

## Extracted schema

``` text
OrderExtractionDraft
- customer_text: string | null
- matched_customer_id: UUID | null
- cny_amount: Decimal | null
- customer_rate: Decimal | null
- evidence: optional field-level evidence metadata
- confidence:
  - customer: 0..1
  - cny_amount: 0..1
  - customer_rate: 0..1
- warnings: string[]
```

Do not ask the model to calculate authoritative IDR. FastAPI calculates
it after confirmation.

## Provider abstraction

Do not couple business code directly to one vendor SDK.

Conceptual interface:

``` python
class VisionExtractionProvider(Protocol):
    async def extract_order(self, image, context) -> RawExtraction:
        ...
```

A provider adapter is responsible for: - API request formatting -
structured-output schema - model-specific errors - usage metadata -
latency metadata

The application service remains provider-independent.

## Context sent to AI

Use minimum necessary context.

Allowed when needed: - screenshot - synthetic/authorized customer
candidate names or narrowly scoped candidate list - extraction
instructions/schema

Do not send: - unrelated account balances - entire transaction history -
full account list unless needed - unrelated customer data -
secrets/tokens

## Customer matching

Prefer a two-step approach: 1. model extracts visible customer text 2.
application performs deterministic/fuzzy candidate matching against
authorized customer master

The model should not be trusted to invent a customer ID.

If match is ambiguous, return candidates/warning and require user
choice.

## Confidence behavior

Confidence is UX guidance, not truth.

Suggested UI policy: - high confidence: normal preview - medium:
visually flag field for review - low/missing: require manual field entry

Never auto-confirm solely because confidence is high.

## Validation

Pydantic must reject/flag: - negative/zero CNY - negative/zero rate -
malformed decimal values - unexpected extra financial fields - invalid
customer UUID - schema mismatch

## Screenshot retention

Default privacy-friendly approach: - process screenshot - retain only if
the user explicitly chooses/needs evidence retention - otherwise delete
temporary object after extraction/short TTL

Exact retention implementation must be documented before production.

## Prompt injection / untrusted image text

Treat all screenshot text as untrusted data. Text inside a screenshot
must never override system/developer extraction instructions or trigger
tools/actions.

The AI endpoint has no direct database write capability for
orders/outflows.

## Duplicate protection

Before confirmation, the app may warn if a likely duplicate exists based
on a combination such as: - same/near customer - same CNY - same rate -
close time/date

Duplicate detection is advisory for v1. Final creation still uses
idempotency protection.

## Evaluation dataset

Use synthetic/anonymized screenshots and chat scenarios.

Recommended initial set: 100+ examples spanning: - clean single order -
abbreviated CNY amounts - multiple numbers in chat - rate
changes/corrections - customer name variations - irrelevant conversation
around the order - cropped screenshot - low-quality screenshot -
multiple orders in one screenshot (flag unsupported or handle
explicitly) - Indonesian slang/abbreviations - ambiguous customer
identity

Never publish real customer chats as portfolio evaluation data.

## Metrics

Report field-level and record-level metrics: - customer text extraction
accuracy - customer matching accuracy - CNY exact-match accuracy - rate
exact-match accuracy - full-record exact match - missing-field rate -
hallucinated-field rate - correction-required rate - latency p50/p95 -
estimated cost per extraction

A useful portfolio report should include error categories, not only
aggregate accuracy.

## Model comparison

Provider/model comparison may evaluate: - accuracy - latency - cost -
structured-output reliability - robustness to screenshot quality

Do not choose a model based only on one headline metric.

## Phase 3/4 possibilities

Only after sufficient real need/data: - statistical/rule-based anomaly
warnings - reconciliation assistant - discrepancy investigation with
tools - natural-language querying over structured records

RAG/vector DB is not required for structured transaction queries.
LangGraph is only justified if a later multi-step tool workflow
genuinely requires state/orchestration.

## AI acceptance criteria

-   extraction never directly posts financial records
-   malformed AI output cannot reach order creation
-   user can correct every extracted field
-   provider outage does not break manual Quick Order
-   real financial calculations remain deterministic
-   evaluation report exists before presenting AI quality claims
