# Buy Me a Tea Support Plan

**Date:** 2026-03-20  
**Status:** Planned  
**Priority:** Low  
**Scope:** Add a lightweight one-time support option so users can tip the project without subscribing to premium.

---

## Goal

Introduce a small, friendly “Buy me a tea” flow that lets users send one-time support payments. This should feel optional, warm, and low-pressure — closer to creator support than a hard monetization feature.

## Product Principles

1. **Optional support only** — no features are locked behind tips
2. **Keep the tone playful** — use “tea” branding consistently in copy and visuals
3. **Low friction** — payment flow should be fast and mobile-friendly
4. **Non-intrusive placement** — support CTA appears in Settings/About and other low-pressure surfaces
5. **Transparent outcome** — explain that tips help fund hosting, maps, and continued development

## Proposed User Experience

### Entry points
- Settings panel: “Buy me a tea” support card
- About/help section: secondary support CTA
- Optional success toast after major milestones (for example after finishing Year in Review sharing), only if this is not spammy

### Support modal/page
- Short explanation of why support helps
- 3 fixed one-time amounts, for example:
  - Tea = $3
  - Tea for two = $7
  - Full teapot = $12
- Optional custom amount if supported cleanly by the payment provider
- Optional short note from the supporter
- Friendly confirmation state after checkout

### Confirmation
- Thank-you message after payment
- Optional celebratory illustration/emoji
- Do **not** add product entitlements unless explicitly designed later

## Technical Approach

### Payments
Use the existing monetization direction from `ToDos/26-monetization-premium.md` and extend the Stripe setup to also support one-time Checkout sessions.

Suggested backend additions:
- `POST /api/support/create-checkout` — creates a one-time Stripe Checkout session for a selected amount
- `POST /api/support/webhook` or reuse the existing billing webhook if keeping all Stripe events in one place
- `GET /api/support/options` — optional endpoint for configurable amounts/copy

Suggested metadata on the Checkout session:
- `user_id`
- `support_type=tea`
- `amount_tier`
- optional `support_message`

### Data model
Store one-time support events separately from subscriptions so they are easy to report on.

Possible DB table:

```sql
CREATE TABLE support_contributions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_intent_id VARCHAR(100) UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  support_type VARCHAR(20) NOT NULL DEFAULT 'tea',
  support_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Frontend
Potential additions:
- `useSupport()` hook for loading support options and opening checkout
- `BuyMeATeaCard` component in Settings/About
- `BuyMeATeaModal` for amount selection and CTA copy
- `SupportSuccessBanner` or confirmation screen after checkout

## Analytics
Track lightweight funnel events:
- `buy_me_a_tea_viewed`
- `buy_me_a_tea_checkout_started`
- `buy_me_a_tea_completed`

Useful dimensions:
- entry point
- amount tier
- authenticated vs anonymous user

## Implementation Phases

### Phase 1 — Design and copy
- [ ] Pick final naming and CTA copy (“Buy me a tea” vs “Support the project”)
- [ ] Decide entry points and placement rules
- [ ] Create lightweight UI mocks for card + modal + success state

### Phase 2 — Backend support payments
- [ ] Add one-time Stripe Checkout session creation
- [ ] Persist successful support payments in a dedicated table
- [ ] Verify webhook handling for completed payments
- [ ] Add environment variables/config for support amounts if needed

### Phase 3 — Frontend integration
- [ ] Add Settings/About support card
- [ ] Build amount picker modal
- [ ] Handle redirect/success UX after checkout
- [ ] Add basic loading and error states

### Phase 4 — Polish and safeguards
- [ ] Add analytics events
- [ ] Prevent repetitive prompting or spammy placement
- [ ] Add admin/reporting visibility for support totals
- [ ] Write tests for checkout request flow and success handling

## Open Questions

- Should support be available to signed-out users, or only authenticated users?
- Should the custom amount option ship in v1 or wait until the fixed tiers are validated?
- Should supporters get a purely cosmetic thank-you badge, or should tips remain entirely invisible?
- Should support payments reuse the premium billing webhook or live in their own isolated handler?

## Recommendation

Start with a **simple Stripe one-time checkout** linked from **Settings only**. Launch with **three fixed amounts** and **no perks**. If users respond well, expand later with better storytelling, optional messages, and more visible entry points.
