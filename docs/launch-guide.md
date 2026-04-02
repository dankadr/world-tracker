# Launch Guide — World Tracker

A step-by-step playbook for launching World Tracker: where to post, what to write, when to post, and how to follow up.

---

## Pre-Launch Checklist

Before posting anywhere, confirm these are live on production:

- [ ] Open the app — map loads, country toggling works
- [ ] Sign in with Google — auth works end-to-end
- [ ] Toggle a few countries, reload — data persists
- [ ] Check dark mode — no jarring white panels
- [ ] Open on mobile — layout is correct, bottom sheet works
- [ ] Offline: turn off wifi, interact, turn wifi back on — changes sync
- [ ] Share URL works — visit a country, hit Share, open the URL in an incognito tab

---

## The One-Line Pitch

> Track every country and region you've visited on an interactive map — with friends, challenges, achievements, and offline support.

Use this or a variation of it everywhere. Keep it concrete and benefit-focused.

---

## Platform Playbook

### 1. Product Hunt

**Best for:** Maximum launch-day exposure. PH drives early adopters, makers, and tech-savvy travelers.

**When:** Tuesday, Wednesday, or Thursday. Post at **12:01 AM PST** (when the PH day resets). The earlier in the day you're live, the more upvotes you accumulate. Never launch on a Monday or Friday.

**What to write:**

*Tagline (60 chars max):*
```
Track every place you've ever been — with friends
```

*Description (250 words max):*
```
World Tracker lets you mark every country and region you've visited on
a beautiful interactive map.

What makes it different:
• Track at any granularity — countries, US states, Swiss cantons, NYC neighborhoods, and more
• Challenge friends to visit the same places — collaborative and competitive modes
• Earn XP and achievements as you explore
• Full offline support — your data syncs when you're back online
• Shareable maps — send a link, anyone can see your travels without logging in
• Works as a PWA — install it like a native app on any device

It started as a personal tool to visualize my own travels. I built the
backend in FastAPI (Python) on Vercel serverless functions, with a React
frontend and PostgreSQL on Neon.

Would love feedback from fellow travelers and builders!
```

*Gallery images to prepare:*
1. World map with several countries highlighted (your own visited map)
2. Region-level view (e.g., Switzerland or US states)
3. Challenges panel with a friend challenge in progress
4. Mobile screenshot — bottom sheet open
5. Achievement unlock popup

**Tips:**
- Ask 10-15 friends to upvote on launch day — the first hour matters most
- Reply to every single comment on launch day, especially early ones
- Post in Slack communities / Discord servers you're in, the morning of launch
- Add "PH: World Tracker" to your Twitter/X bio the day before

---

### 2. Hacker News — Show HN

**Best for:** Technical users, feedback from developers, potential contributors.

**When:** Tuesday–Thursday, between **9 AM and noon US Eastern**. Avoid Monday mornings (crowded) and Fridays (low traffic).

**What to write:**

*Title:*
```
Show HN: World Tracker – mark every country/region you've visited, with friends and challenges
```

*Body (post as a comment on your own submission):*
```
I built World Tracker to scratch my own itch — I wanted to track every
country and sub-region I'd visited, not just check boxes on a flat list.

Tech stack:
- React + Vite frontend (deployed as static to Vercel)
- FastAPI backend on Vercel serverless functions (Python)
- PostgreSQL on Neon
- PWA with offline-first batch queue
- Client-side encryption for user data
- Google Sign-In with JWT auth

Things that were harder than expected:
- Making Leaflet work reliably with offline caching via Workbox
- Atomic challenge completion (TOCTOU race condition with concurrent requests)
- Getting the mobile bottom sheet UX right — snap points, scroll vs drag, orientation

Happy to discuss any of the implementation details. Would love feedback,
especially on performance — the initial bundle is still too large.

[link]
```

**Tips:**
- Don't ask for upvotes on HN — it's against the rules and will get you flagged
- Engage genuinely with every comment — HN rewards good conversation
- Have thick skin — HN comments can be blunt

---

### 3. Reddit

Post to multiple subreddits on the same day, but space them out by a few hours.

**r/solotravel** (2.5M members)
- Best angle: "I built a tool to track everywhere I've been — would love feedback from fellow solo travelers"
- Tone: personal, traveler-first, not tech-heavy
- Post type: text post with a link, include a screenshot

*Title:*
```
I built a free tool to track every country and region you've visited — with shareable maps and friend challenges
```

*Body:*
```
Been solo traveling for a few years and got tired of just counting countries.
I wanted to see exactly where I've been — down to the state/canton/neighborhood level.

So I built World Tracker: an interactive map where you can mark everywhere you've been,
challenge friends to visit the same places, earn achievements, and share your map as a link.

It's free, works offline, and you don't need an account to use the share links.

Would love feedback from fellow travelers — especially on which trackers to add next.
```

---

**r/travel** (10M members)
- Same angle as r/solotravel, slightly shorter post
- Avoid being too promotional — lead with the travel angle, not the tech

---

**r/webdev** and **r/sideprojects**
- Tech-forward angle: share the stack, what was hard, what you learned
- These audiences appreciate honesty about what's not perfect yet

*Title for r/sideprojects:*
```
I spent 3 months building a travel tracker app — here's what I shipped
```

*Body:* Link to the app + brief stack description + 2-3 things you learned building it. Keep it humble and genuine.

---

### 4. X / Twitter

**When:** Any day, morning (8–10 AM in your timezone or US Eastern).

**Thread format (post as a thread):**

```
Tweet 1:
I built World Tracker — mark every country and region you've ever visited
on an interactive map, challenge friends, earn achievements.

It's free and works offline. Here's what I made 🧵

[screenshot of a full world map]

Tweet 2:
You can track at any level of detail:
• 195 countries
• US states
• Swiss cantons
• NYC neighborhoods
• ...more coming

Mark visited, wishlist, or skip — all synced across devices.

Tweet 3:
My favorite feature: friend challenges.

Create a challenge (e.g., "visit all 50 US states") and compete or
collaborate with friends to complete it first. XP and achievements for everyone.

Tweet 4:
Built with:
→ React + Vite (PWA, offline-first)
→ FastAPI on Vercel serverless
→ PostgreSQL (Neon)
→ Workbox for offline tile + API caching
→ Client-side encryption for user data

Tweet 5:
Try it: [link]

Would love feedback — especially from travelers who want specific trackers added.

RT appreciated 🙏
```

**Tips:**
- Tag relevant accounts: @ProductHunt (on launch day), geography/travel accounts with engaged audiences
- Use 2-3 relevant hashtags: #buildinpublic #travel #indiemaker
- Pin the thread to your profile on launch day

---

### 5. Indie Hackers

**When:** Any day. IH content stays visible longer than social posts.

**Post type:** "Show IH" post — share your story

*Title:*
```
I built a travel tracker with offline support, friend challenges, and XP — here's what I learned
```

*Body:* 400–600 word post covering:
1. The problem you were solving for yourself
2. What the app does
3. The most interesting technical challenge (the offline batching, the TOCTOU race condition fix, etc.)
4. Current status (free, no monetization yet)
5. What you want feedback on

IH readers appreciate honesty about MRR ($0 is fine to say), what's working, and what's not.

---

## Timing Strategy

If you want maximum coordinated exposure:

| Day | Action |
|-----|--------|
| T-7 | Prepare Product Hunt listing, write all copy, get screenshots ready |
| T-3 | Soft-post on Twitter/X (no big push yet), get a few early eyes |
| T-1 | Tell friends to be ready to upvote/comment on PH tomorrow morning |
| **Launch day** | **12:01 AM PST — go live on PH** |
| Launch day +2h | Post Show HN |
| Launch day +4h | Post r/solotravel |
| Launch day +6h | Post r/webdev |
| Launch day +8h | Post Indie Hackers |
| Launch day +24h | Reply to everything. Thank people. Ship one small improvement based on feedback and post about it. |

---

## What NOT to Do

- Don't post everywhere on the same minute — it looks like spam and platforms detect it
- Don't post on Reddit and immediately ask people to upvote — instant ban risk
- Don't ignore comments — dead threads kill momentum
- Don't wait for it to be "perfect" — ship it, collect feedback, iterate
- Don't skip mobile screenshots — most upvoters on PH are on their phones

---

## Post-Launch

After the initial wave:

1. **Write a brief "what happened" post** on X/Twitter and IH — "launched yesterday, here's what I learned from the first N users"
2. **Add the most-requested tracker** (watch comments for patterns) and post an update
3. **Set up Sentry alerts** — you'll see real errors from real users that didn't come up in testing
4. **Watch Vercel Analytics** — check which pages/views get used, which don't

---

## App URL

https://right-world-tracker.vercel.app

---

*Last updated: April 2026*
