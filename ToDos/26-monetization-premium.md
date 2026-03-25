# ToDo: Monetization & Premium Tier

**Date:** 2026-03-16
**Status:** Planned — no billing infrastructure exists yet
**Priority:** Low-Medium (future)
**Scope:** Define and implement a freemium model with a premium subscription using Stripe, while keeping the core tracker free forever

---

## Overview

The app is currently free with no monetization. As the user base grows, infrastructure costs (Neon DB, Vercel bandwidth, Blob storage for photos) will scale linearly. A premium tier funds continued development without compromising the core free experience. The goal is "free gets you hooked, premium makes you love it."

## Reality Check (2026-03-25)

- There is no Stripe dependency, billing endpoint, premium field set, or premium UI in the current repo
- Some future plans reference premium-gated features, but they are still conceptual dependencies rather than shipped hooks
- This ToDo should be read as a product plan, not an in-progress implementation

## Principles

1. **Core tracker is always free** — visiting countries, regions, bucket list, friends, games
2. **Premium enhances, not gates** — premium features are nice-to-haves, not pay-to-play
3. **No ads ever** — a travel app should feel luxurious, not cheap
4. **Transparent pricing** — one flat monthly/annual price, no tiers within premium

## Free vs Premium Feature Split

| Feature | Free | Premium |
|---------|------|---------|
| World map + all trackers | ✅ | ✅ |
| Friends (up to 5) | ✅ | ✅ |
| Friends (unlimited) | ❌ | ✅ |
| Bucket list (up to 50 items) | ✅ | ✅ |
| Bucket list (unlimited) | ❌ | ✅ |
| Photo attachments (ToDo #16) | ❌ | ✅ |
| Custom map markers (ToDo #22) | Free: 5 markers | Unlimited |
| Data export (JSON/CSV) | ✅ | ✅ |
| Advanced export (PDF travel book) | ❌ | ✅ |
| Year in Review | ✅ | ✅ |
| Yearly analytics history (all years) | Last 1 year | All years |
| Daily challenge streaks | ✅ | ✅ |
| Custom avatar items unlocked at level | Level gates | All unlocked |
| Public profile | ✅ | ✅ |
| Profile badge: "Premium Explorer" | ❌ | ✅ |
| Collaborative maps (ToDo #27) | ❌ | ✅ |
| Priority support | ❌ | ✅ |

## Pricing (suggested)

- Monthly: $3.99/month
- Annual: $29.99/year (~$2.50/month, 37% discount)
- Lifetime: $79.99 one-time (limited availability)

## Technical Design

### Stripe Integration

Backend dependencies:
```
stripe>=7.0.0
```

New DB additions:
```sql
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(50);
ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN premium_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN premium_source VARCHAR(20);  -- 'stripe' | 'lifetime' | 'manual'
```

New endpoints:
- `POST /api/billing/create-checkout` — create Stripe Checkout session, return `{ url }`
- `POST /api/billing/portal` — create Stripe Customer Portal session (manage subscription)
- `POST /api/billing/webhook` — Stripe webhook handler (subscription created/updated/deleted)
- `GET /api/billing/status` — return `{ is_premium, expires_at, plan }`

Stripe webhook events to handle:
- `checkout.session.completed` → activate premium
- `customer.subscription.updated` → update expiry
- `customer.subscription.deleted` → deactivate premium
- `invoice.payment_failed` → send dunning email (or notification)

### Premium Check

Backend helper:
```python
def is_premium_active(user: User) -> bool:
    if user.is_premium and user.premium_expires_at is None:
        return True  # lifetime
    return (
        user.is_premium and
        user.premium_expires_at is not None and
        user.premium_expires_at > datetime.now(timezone.utc)
    )
```

Frontend hook `usePremium()`:
```js
// Returns { isPremium, isLoading, openUpgrade, openPortal }
// Caches status in localStorage with 1-hour TTL
```

### Premium Gating Pattern

```jsx
// Reusable gate component
function PremiumGate({ feature, children, fallback }) {
  const { isPremium } = usePremium();
  if (isPremium) return children;
  return fallback ?? <PremiumUpgradePrompt feature={feature} />;
}

// Usage:
<PremiumGate feature="photos">
  <PhotoUploadButton />
</PremiumGate>
```

`PremiumUpgradePrompt` — small inline banner with feature description + "Upgrade" CTA. Never a full-screen paywall.

### Upgrade Flow

1. User taps a gated feature → sees `PremiumUpgradePrompt`
2. Taps "Upgrade" → opens `UpgradeModal`
3. `UpgradeModal` shows feature list, pricing, "Start monthly" / "Go annual" / "Lifetime" buttons
4. Clicking a plan → `POST /api/billing/create-checkout` → redirect to Stripe Checkout
5. Stripe Checkout → success URL back to app (`/#/premium/success`)
6. Success page → confetti + premium activated message
7. Webhook arrives (async) → marks user premium in DB

### Revenue Tracking

Add Vercel Analytics custom events:
```js
track('upgrade_prompt_shown', { feature });
track('upgrade_clicked', { feature, plan });
track('upgrade_completed', { plan });
```

## Implementation Phases

### Phase 1 — Backend Stripe plumbing
- [ ] Add `stripe` to requirements.txt
- [ ] DB migration: stripe fields on users table
- [ ] `POST /api/billing/create-checkout`
- [ ] `POST /api/billing/webhook` (signature verification)
- [ ] `GET /api/billing/status`
- [ ] `is_premium_active()` helper
- [ ] Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` env vars

### Phase 2 — Frontend hooks + gate
- [ ] `usePremium()` hook
- [ ] `PremiumGate` component
- [ ] `PremiumUpgradePrompt` inline banner
- [ ] `UpgradeModal` with pricing options
- [ ] Success page + confetti

### Phase 3 — Feature gating
- [ ] Friends limit enforcement (check count before adding)
- [ ] Bucket list limit enforcement
- [ ] Photo attachments gated (Phase 1 of ToDo #16)
- [ ] Custom markers limit (5 free vs unlimited)
- [ ] Premium badge on profile

### Phase 4 — Billing management
- [ ] `POST /api/billing/portal` → Stripe Customer Portal
- [ ] "Manage subscription" in Settings
- [ ] Handle `payment_failed` gracefully (grace period of 3 days before deactivation)
- [ ] Tests: webhook processing, premium status expiry

## Notes

- Start by building the infrastructure with Stripe in test mode — don't rush to launch premium
- Grandfather early users (first 100) with free premium for life as a loyalty reward
- The "Premium Explorer" badge on profiles is a viral mechanism — it shows in the leaderboard and friend lists
- Never show a hard paywall — always show the feature with a "try with premium" prompt
- Lifetime deal should be time-limited (e.g., only during launch week) to create urgency
