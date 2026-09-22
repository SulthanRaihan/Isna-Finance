# Visual Design System v1 --- Isna Finance

## Design direction

Reference direction: clean, simple modern mobile-finance UI.

The product should feel: - clean - calm - trustworthy - lightweight -
friendly but professional - easy to scan during busy transaction entry

Avoid: - dense enterprise-dashboard appearance - excessive gradients -
glassmorphism everywhere - decorative charts without operational value -
too many accent colors - excessive borders - oversized cards that waste
mobile space - making the product look like a banking app that transfers
money

## Brand

Working product name: **Isna Finance**

Brand identity is intentionally provisional. Color/brand polish may be
revised after the functional MVP is visually tested.

## Platform priority

1.  Mobile web / phone first
2.  Desktop fully supported and important for recap/management
3.  Same workflow and information hierarchy across breakpoints

Do not design two different products for mobile and desktop.

## Theme

-   Light mode only for v1.
-   Dark mode is out of MVP.
-   UI background should be a very light neutral rather than harsh pure
    gray.
-   Surfaces/cards are white or near-white.
-   Use subtle separation through spacing, soft borders, and restrained
    shadows.

## Color strategy

Color is deliberately not fully brand-frozen yet.

Use semantic design tokens instead of hardcoded colors throughout
components:

``` text
--background
--surface
--surface-muted
--foreground
--foreground-muted
--border
--primary
--primary-foreground
--success
--warning
--danger
--info
```

Initial implementation may use a restrained modern blue as `primary`,
inspired by the provided finance UI reference. It must be easy to
replace globally later.

Do not encode business meaning using primary color.

Semantic status colors: - success: completed / reconciled - warning:
requires attention - danger: destructive/error only - info: neutral
operational state

Never communicate status using color alone.

## Typography

Preferred direction: modern neutral sans-serif suitable for
numeric-heavy interfaces.

Use: - application font: Geist or the default high-quality Next.js sans
stack - tabular numerals for financial figures where supported

Hierarchy: - Page title: 24--28px / semibold - Major financial value:
28--36px / bold - Section heading: 16--18px / semibold - Body: 14--16px
/ regular - Label/helper: 12--14px / medium/regular

Avoid excessive font weights.

## Spacing

Base spacing system: `4, 8, 12, 16, 20, 24, 32`

Mobile page horizontal padding: - default 16px - 20px where screen width
allows

Section gaps: - 20--24px

Card internal padding: - 16px standard - 20px hero/summary cards

## Radius

Use soft but not cartoonish rounding.

Recommended: - small controls/badges: 8--10px - inputs/buttons: 12px -
standard cards: 16px - hero cards/sheets: 20px - circular icon buttons:
full radius

Do not make every container a pill.

## Shadows and borders

Cards: - subtle 1px neutral border OR very soft shadow - avoid heavy
floating shadows

Primary/hero financial card may have slightly stronger visual elevation.

Tables/lists: - prefer dividers/spacing over putting every row inside an
individual card

## Card system

### Hero Summary Card

Use for the most important daily summary.

Example:

``` text
╭──────────────────────────────╮
│ Today's Profit               │
│ Rp 2.541.200                 │
│                              │
│ Money In       Money Out     │
│ Rp84.3m        Rp81.8m       │
╰──────────────────────────────╯
```

On Home, do not create four equally dominant giant cards. Establish
hierarchy: 1. profit/primary summary 2. CNY + customer/order metrics 3.
operational attention

### Metric Card

Compact:

``` text
╭────────────────╮
│ Total CNY      │
│ ¥48,250        │
│ 17 customers   │
╰────────────────╯
```

### Attention Card

For actionable states:

``` text
╭──────────────────────────────╮
│ Ready to Send             3  │
│ RMB still needs fulfillment  │
╰──────────────────────────────╯
```

### List Container

Transactions/orders should normally share one grouped surface rather
than each row becoming a floating card.

## Buttons

Primary: - filled primary - one dominant CTA per context

Secondary: - neutral surface/border

Destructive: - danger only for destructive action

Mobile primary actions should be at least \~44px high.

Examples: - Save Order → Primary - Mark IDR Received → Primary/positive
action - Edit → Secondary - Void → Destructive

## Inputs

-   clear label above input
-   large numeric input for CNY/rate where appropriate
-   helper text only when useful
-   validation near the field
-   currency/unit suffix/prefix where helpful
-   use numeric mobile keyboard

Calculated fields such as Expected IDR should visually look read-only,
not like another editable input.

## Financial number treatment

Always make currency explicit.

Good: - `Rp26,470,000` - `¥10,000` - `Rate 2,647`

Avoid unlabeled bare numbers.

Use tabular numerals in transaction lists/tables where possible.

Do not use green/red solely to mean Money In/Money Out. Labels and signs
must remain understandable without color.

## Status system

UI-facing statuses: - Awaiting Payment - Ready to Send - Completed -
Needs Attention - Voided

Use compact badge + icon/text.

Examples:

``` text
○ Awaiting Payment
→ Ready to Send
✓ Completed
! Needs Attention
```

## Icons

Use one consistent icon library, preferably Lucide.

Rules: - simple outline icons - avoid decorative icons without
function - pair unfamiliar icons with text - consistent 18--22px normal
icon sizing

## Navigation

### Mobile

Bottom navigation: - Home - Orders - centered Quick Order action -
Activity - More

Quick Order must remain visually prominent without looking like a
money-transfer button.

### Desktop

Use left sidebar: - Isna Finance brand - Home - Orders - Quick Order -
Activity - Daily Recap - Customers - Accounts - Teams - Settings

Desktop content max width should prevent excessively stretched forms.

## Responsive behavior

Mobile: - single-column - sticky/accessible primary actions when
useful - cards stack vertically - bottom navigation

Tablet/Desktop: - summary cards may use grid - order/activity data can
become structured table/list - forms stay constrained in width - sidebar
replaces bottom nav

## Home visual hierarchy

Recommended Home composition:

``` text
Header
Isna Finance / greeting       notifications/profile

Date + today's account

Hero Profit Summary
├─ Profit
├─ Money In
└─ Money Out

Compact Metrics
├─ Total CNY
└─ Customers

Needs Attention
├─ Awaiting Payment
├─ Ready to Send
└─ Reconciliation warning

Recent Orders
```

Avoid unnecessary charts on the default Home. Charts can be introduced
later only when they answer a real question.

## Quick Order visual hierarchy

Quick Order should be one of the simplest screens: 1. customer 2. CNY 3.
rate 4. calculated IDR 5. receiving account 6. optional note 7. Save
Order

Do not add analytics or unrelated context to this screen.

## Daily Recap

Daily Recap can be more data-dense than Home, but should retain: -
strong summary at top - clear Money In / Money Out sections - category
breakdown - team reconciliation - unfinished items

Desktop recap can use a wider table-oriented presentation.

## Loading states

Use skeletons matching final layout for: - dashboard summary - order
lists - recap

Avoid full-page spinner when partial content can load independently.

## Empty states

Keep concise and action-oriented.

Example:

``` text
No orders today
Create the first order when a customer comes in.

[ + New Order ]
```

## Error states

Errors should: - state what failed - preserve user-entered values -
offer retry when appropriate - never imply a financial action succeeded
if backend confirmation failed

## Success feedback

Use restrained toast/banner feedback: - `Order saved` -
`IDR marked as received` - `RMB marked as sent`

Do not rely on celebration animations for routine financial operations.

## Accessibility

-   minimum comfortable touch targets
-   sufficient text/background contrast
-   visible keyboard focus
-   semantic labels
-   no status by color alone
-   buttons must have accessible names
-   financial information must remain readable at zoom

## shadcn/ui implementation guidance

Prefer composing: - Card - Button - Input - Label - Badge - Tabs -
Sheet/Drawer - Dialog - DropdownMenu - Command/Combobox for customer
selection - Table for desktop - Skeleton - Toast/Sonner - Alert

Do not accept default component styling blindly. Apply the Isna Finance
token/radius/spacing system consistently.

## Visual reference interpretation

Take from the supplied reference: - generous whitespace - clear large
financial numbers - soft cards - restrained blue accent - simple
iconography - clean bottom navigation - obvious hierarchy - compact
grouped transaction lists

Do NOT copy: - banking transfer/request functionality - investment
widgets - generic AI insight cards - charts simply because the reference
has them

The product must visually reference a modern finance tool while
remaining operationally specific to Isna's workflow.

## Visual design freeze level

Frozen for implementation: - light-only MVP - clean modern finance
direction - soft-medium rounding - balanced information density -
mobile-first - desktop supported - working brand `Isna Finance` -
semantic token system - simple blue may be used provisionally

Not frozen: - final primary hue - final logo - final brand identity -
decorative illustration style

Those can be polished after functional UI review without rewriting
product architecture.
