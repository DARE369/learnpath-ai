# Packet 4.3 — Free Tier Experience

**Status:** Shipped
**Stage:** 4 (Monetization layer)
**Depends on:** Packets 4.1 and 4.2

Engaging free tier with rotating upgrade CTAs and contextual prompts.
Keeps free users motivated while encouraging conversion to paid plans.

## What was built

### Backend

| File | Role |
|------|------|
| `services/ad_service.py` | Rotating upgrade CTAs; deterministic hash-based selection per (user_id, placement, hour) — no DB write needed |
| `services/free_tier_service.py` | Feature availability map, upgrade prompt payloads, success stories |
| `routers/free_tier.py` | `/api/free-tier/*` endpoints |
| `main.py` | Registers `/api/free-tier` router |

### Frontend

| File | Role |
|------|------|
| `components/Ads/AdBanner.tsx` | Horizontal/sidebar upgrade banner; client-side rotation every 5 min; returns null for paid users |
| `components/Billing/UpgradePrompt.tsx` | Inline or modal upgrade prompt; sessionStorage prevents re-showing same context per session |
| `components/Success/SuccessStoriesWidget.tsx` | Auto-rotating success stories (30 s interval); navigation arrows + progress dots |
| `pages/dashboard.tsx` | AdBanner after welcome banner; SuccessStoriesWidget in bottom sidebar |

### Tests

- `tests/unit/test_free_tier.py` — 30 tests: ad rotation, feature availability, prompt generation, story retrieval. No DB or network.

## Design decisions vs. packet brief

| Packet spec | What was built | Reason |
|-------------|----------------|--------|
| `Ad`, `AdImpression`, `SuccessStory`, `UpgradePrompt` DB tables | No new tables | CTAs are hardcoded (static upgrade copy, not external ad network). Impression tracking adds schema without user-facing value at MVP — navigation to /billing IS the click signal. Tables can be added later for analytics. |
| Third-party ad network | Internal self-promotion CTAs | LearnPath AI's "ads" are upgrade prompts, not external ads |
| Monthly cron + email for ad rotation | Deterministic hash per (user, placement, hour) | No infra needed; same UX result |

## Feature availability map

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| Browse / watch videos | Yes (capped) | Yes | Yes |
| Answer questions | Yes (capped) | Yes | Yes |
| Concept branching | Yes | Yes | Yes |
| Offline download | No | Yes | Yes |
| Advanced questions | No | Yes | Yes |
| Ad-free | No | Yes | Yes |
| Custom paths | No | No | Yes |
| Certificate generation | No | No | Yes |
| Priority support | No | No | Yes |

## Upgrade prompt contexts

| Context | Title |
|---------|-------|
| `feature_locked` | This feature requires Pro |
| `video_limit_reached` | You've watched all your free videos |
| `approaching_limit` | Running low on videos |
| `question_limit` | Daily question limit reached |
| `search_limit` | Search limit reached for this hour |
| `general` | Get more from LearnPath AI |

## API endpoints

```
GET  /api/free-tier/ads/{placement}           # rotating CTA for placement (null for paid users)
GET  /api/free-tier/upgrade-prompt/{context}  # prompt payload for context
GET  /api/free-tier/features                  # full feature map for user's plan
POST /api/free-tier/features/check            # check single feature availability
GET  /api/free-tier/success-stories           # random success stories (?count=N)
```
