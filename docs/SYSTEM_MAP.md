# LearnPath AI — System Map & User-Flow Guide

> **Purpose of this document.** We've built a lot of features across many packets,
> but the *connective tissue* — how a user actually moves from one to the next —
> was never written down in one place. This is that map. It covers the **frontend
> navigation graph**, the **backend API surface**, how the two are wired, the
> **loops** the experience cycles through, the **dead-ends/gaps** I found, and a
> root-cause diagnosis of the **"I have to log in every time"** bug.
>
> Last mapped: 2026-06-04. Reflects the code on `main` as of commit `ecdbde8`.

---

## 0. How to read this

The app is a **Next.js Pages Router** frontend (Vercel) talking to a **FastAPI**
backend (Railway) over a single proxy: every browser call is to a relative
`/api/*` URL, which Next.js rewrites server-side to the backend. So "frontend"
and "backend" are two trees joined at `/api/*`.

There are **three audiences** baked into the routing, and they barely cross over:

| Audience | Entry | Home base | Route prefix |
|---|---|---|---|
| **Learner** (default) | `/auth/login` → `/onboarding` → `/dashboard` | `/dashboard` | most routes |
| **Teacher** (B2B) | login → `/teacher/dashboard` | `/teacher/*` | `/teacher`, `/school` |
| **Admin** (internal) | login → `/admin` (gated) | `/admin` | `/admin/*` |

---

## 1. TL;DR — the "happy path" from login to the deepest point

```
LAND          /                     marketing page; "Get started" / "Sign in"
  │
SIGN UP       /auth/signup          create account → token issued
  │           (or /auth/login)
  ▼
ONBOARD       /onboarding           6-step learner profile; forced here until
  │                                 onboarding_completed = true
  ▼
HUB           /dashboard            ← you always come back here. Stats, streaks,
  │                                 achievements, "Continue learning", recommended
  │
  ├─► EXPLORE /explore              type a topic → POST /api/search/build-path
  │      │                          builds a path, then routes you into…
  │      ▼
  │   LEARN   /learning/{pathId}/{i}  ◄── THE DEEPEST POINT / core loop
  │      │                          video player + transcript + concept sidebar
  │      │                          + inline quiz (active recall) + branch choices
  │      │                          advancing the video index walks the path
  │      ▼
  │   QUIZ    (QuizModal, in-page)  answer questions → score → feeds FSRS deck
  │      │                          → mastery updates → may unlock next module
  │      ▼
  │   REVIEW  /review               spaced-repetition (FSRS-5) of everything you
  │                                 learned; due cards resurface here daily
  │
  └─► (alternate entries to the same learning loop)
      /paths        your saved adaptive paths → /paths/{id} → modules → LEARN/QUIZ
      /concepts     knowledge graph → /concepts/{id} → "Build a path" → /paths/{id}
      /exams        exam tracks → "Build study path" → /paths/{id}
                              └─► /exams/mock/{trackId}  timed mock exam
      /upload       drop a PDF/URL → transform → /content/{id} (notes/quiz)
      /notes        AI study notes from a video → /notes/{youtubeId}
```

**The shortest sentence:** *Log in → onboard → land on the dashboard → start a
topic from Explore (or a Path/Concept/Exam) → learn in the video+quiz player →
the questions you see feed a spaced-repetition deck you clear in Review → repeat.*

---

## 2. Authentication & session — and the re-login bug

### How auth works today
- **Login** (`POST /api/auth/login`) returns a short-lived **access token (15 min)**
  in the JSON body, and sets a **refresh token (7 days)** as an `httpOnly` cookie.
- The access token is stored client-side by `hooks/useAuth.tsx`:
  - **"Keep me signed in" checked** → `localStorage` (survives browser restart).
  - **unchecked (the default)** → `sessionStorage` (dies when the tab/window closes).
- A global axios interceptor catches any `401`, calls `POST /api/auth/refresh`
  (using the cookie), gets a fresh access token, and retries the request. This is
  why you *don't* normally get kicked out every 15 minutes while clicking around.

### 🐞 Root cause of "every time I log in, I have to log in again"
There are **three compounding causes**, in order of impact:

1. **The bootstrap never tries the refresh cookie.**
   In `useAuth.tsx`, on a fresh page load the code reads the stored access token;
   **if there isn't one, it gives up immediately** (`setLoading(false); return;`)
   and shows the login screen — *even though a valid 7-day refresh cookie may still
   exist.* So any time the access token isn't in storage (new tab, browser
   restart, or it simply wasn't persisted), you're sent back to login despite
   being "remembered."
   → **Fix:** on bootstrap with no stored token, still call `/api/auth/refresh`;
   if it returns a token, restore the session. *(Small, low-risk — I can apply it.)*

2. **"Keep me signed in" defaults to OFF.**
   So the token lands in `sessionStorage` and is gone the moment you close the tab.
   Combined with #1, closing the tab = guaranteed re-login.
   → **Fix:** default the checkbox to on, *or* always use `localStorage`.

3. **The misconfigured API URL breaks the refresh round-trip in production.**
   While `NEXT_PUBLIC_API_URL` points at `localhost` (see `docs`/ops ledger), the
   `/api/auth/refresh` proxy can't reach the backend, so the interceptor's
   recovery path fails and you fall back to login. Fixing the Vercel env var
   (to the Railway `https://` URL) is a prerequisite for #1 and #2 to actually help.

> **Bottom line:** the 7-day "remember me" was *designed* to keep you signed in,
> but bug #1 means the app throws that cookie away on every cold load. That single
> fix is the biggest win.

### Route gating (`pages/_app.tsx`)
- `PROTECTED_PREFIXES` — these require a user; otherwise → `/auth/login?next=…`.
- Not-yet-onboarded users are force-redirected to `/onboarding`.
- `/admin/*` additionally requires `user.role === "admin"`, else → `/dashboard`.
- `NO_CHROME_PATHS` (`/`, auth pages, `/onboarding`) hide the navbar.

---

## 3. Frontend navigation map (the full tree)

```
PUBLIC
 /                         Landing (redirects to /dashboard if already logged in)
 /auth/login               → next param or /dashboard · → /auth/signup · → /auth/forgot-password
 /auth/signup              → /onboarding
 /onboarding               6-step profile → /dashboard

LEARNER (navbar PRIMARY links)
 /dashboard ───────────────┐  HUB. → /explore, → "Continue" (/learning/…)
 /explore                  │  search box → builds a path → /learning/{id}/0
 /paths                    │  saved paths list → /paths/{pathId}
   └ /paths/[pathId]       │  modules: lesson → /learning · quiz → QuizModal
 /exams                    │  exam tracks → build path → /paths/{id}
   └ /exams/mock/[trackId] │  timed mock exam (countdown, sections, auto-score)
 /review                   │  FSRS spaced-repetition deck → /dashboard
 /learning/[pathId]/[i] ◄──┘  CORE PLAYER: video + transcript + concepts + quiz + branches

LEARNER (navbar "More" dropdown)
 /upload                   drop PDF/URL → transform → /content/{contentId}
   └ /content/[contentId]  transformed content: summary, notes, quiz, PDF export
 /notes                    AI study notes index → /notes/{youtubeId}
   └ /notes/[youtubeId]    generated notes + flashcards ("Add to deck" → Review)
 /concepts                 knowledge graph index → /concepts/graph, /concepts/{id}
   ├ /concepts/graph       visual SVG map → /concepts/{id}
   └ /concepts/[conceptId] concept detail → "Build a path" → /paths/{id}
 /buddies                  study-buddy search, chat, sharing (realtime WS)
 /referral                 referral program
 /loyalty                  loyalty points/rewards
 /settings                 account settings (PATCH /api/auth/me)

LEARNER (user-menu / billing)
 /billing                  plan & feature matrix → /payment
 /payment                  Flutterwave checkout
 /courses/[courseId]       (legacy course view)
 /review, /referral, /loyalty also reachable from the user menu

TEACHER (B2B — not in the learner navbar)
 /teacher/dashboard        class overview
 /teacher/at-risk          at-risk students
 /teacher/class/[id]       single class detail
 /school/dashboard         school-wide analytics

ADMIN (role=admin only; navbar shows "Admin")
 /admin                    admin home → the dashboards below
 /admin/analytics          revenue / cohort / metrics
 /admin/customer-success   org health & churn
 /admin/expansion          self-building content expansion
 /admin/confidence         answer-confidence / quality control
 /admin/blacklist          blocked content
```

### ⚠️ Navigation gaps & dead-ends I found
These are the "how do I get from here to there?" holes — places that exist but
aren't reachable by clicking, or that loop back on themselves:

1. **Teacher & School areas have no nav entry.** `/teacher/*` and `/school/*` are
   fully built but **nothing in the navbar links to them.** A teacher can only
   reach them by typing the URL. There's no role-based "Teacher" link the way
   there is for Admin. → *Add a `role === "teacher"` nav link, or a workspace switcher.*
2. **`/dashboard` "Continue learning" points at `/learning/demo/0`** — a hard-coded
   **demo** path, not the user's actual in-progress path. New users hit a canned
   demo instead of their real next lesson. → *Wire it to the last active path.*
3. **`/explore` is the only organic entry to the learning loop**, yet the dashboard
   doesn't surface recommended *topics* that deep-link into it — `RecommendedCourses`
   exists as a component but the dashboard's primary CTA is the demo link above.
4. **No global "search" affordance in the navbar.** Explore is a tab, but there's
   no persistent search box; from a deep page (e.g. a concept), starting a brand-new
   topic means navigating back to Explore.
5. **`/courses/[courseId]`** appears to be a legacy surface with no inbound links
   from the current navbar/dashboard — likely superseded by `/paths` and `/learning`.
6. **Loyalty / Referral appear in BOTH the "More" dropdown and the user menu** —
   harmless duplication, but worth consolidating.
7. **`/billing` ↔ `/payment`** is a clean two-step, but there's no return path shown
   from a successful payment back into the product (relies on redirect).

---

## 4. The loops (where the experience "recycles")

The product is intentionally cyclical. There are **three engines** that keep
bringing the user back:

### Loop A — The learning loop (minute-to-minute)
```
pick topic (Explore/Path/Concept/Exam)
   → /learning player: watch a chunk
   → inline quiz (active recall)        ← QuizModal / QuestionCard
   → score recorded → mastery updated
   → branch choice or next video index
   → (repeat until path complete)
```
Backed by: `search`, `path`, `branching`, `quizzes`, `progress`, `eqs`.

### Loop B — The retention loop (day-to-day)
```
questions you answered → become FSRS cards
   → /review surfaces today's DUE cards (FSRS-5 scheduler)
   → grade recall → next due date recomputed (3→11→35→101→269d…)
   → streak + achievements updated on /dashboard
   → notification/heartbeat nudges you back
```
Backed by: `services/fsrs.py`, `quizzes` (review endpoints), `dashboard`,
`notes` flashcards ("Add to deck" feeds this same deck).

### Loop C — The adaptation loop (week-to-week, automatic)
```
your performance on path modules
   → nightly job jobs/path_adaptation.py (03:30 UTC)
   → adaptive_path_service re-sequences / inserts remediation
   → path on /paths/{id} reshapes to your gaps
   → concept graph marks mastered vs. weak concepts
```
Backed by: `adaptive_paths`, `knowledge`, `remediation`, `expansion` (content
self-building), apscheduler jobs.

---

## 5. Backend API surface (grouped by what it powers)

Every endpoint is under `/api`. Auth is via `Authorization: Bearer <access token>`
resolved by `routers/auth.py:get_current_user` (the real one; the `dependencies.py`
copy is a dead Stage-2 placeholder — don't use it).

| Domain | Router prefix(es) | Powers (frontend) |
|---|---|---|
| **Auth & session** | `/api/auth`, `/api/sessions` | login/signup/refresh/me, route gating |
| **Search → path** | `/api/search`, `/api/path` | Explore → learning loop entry |
| **Learning player** | `/api/youtube`, `/api/summary`, `/api/branching`, `/api/eqs`, `/api/eqs/expanded` | `/learning` video, transcript, branches, quality |
| **Quiz / recall / FSRS** | `/api/quiz` (quizzes), `/api/questions` | inline quiz + `/review` deck |
| **Progress** | `/api/progress` | mastery, streaks, "continue" |
| **Concept graph** | `/api/knowledge` (new), `/api/concepts` (legacy extractor) | `/concepts`, `/concepts/graph` |
| **Adaptive paths** | `/api/adaptive-paths` | `/paths`, nightly adaptation |
| **Exams** | `/api/exams` | `/exams`, `/exams/mock` |
| **Notes** | `/api/notes` | `/notes`, flashcards |
| **Upload / transform** | `/api/content` | `/upload`, `/content/{id}` |
| **Buddies / realtime** | `/api/buddies`, `/api/ws` (realtime) | `/buddies`, presence, chat |
| **Dashboard** | `/api/dashboard`, `/api/learner` | `/dashboard`, school dashboard |
| **Remediation / expansion** | `/api/remediation`, `/api/expansion` | auto-fix gaps, self-building content |
| **Monetization** | `/api/subscriptions`, `/api/payments`, `/api/usage`, `/api/free-tier`, `/api/features` | `/billing`, `/payment`, feature locks |
| **Growth** | `/api/referral`, `/api/loyalty`, `/api/analytics` | `/referral`, `/loyalty`, admin analytics |
| **B2B** | `/api/organizations`, `/api/teachers`, `/api/schools` | `/teacher/*`, `/school/*` |
| **Admin internal** | `/api/admin/customer-success`, `/api/blacklist`, `/api/cache` | `/admin/*` |
| **Video chunking** | `/api/chunks` (video_chunks) | chapter splitting in the player |

---

## 6. Frontend → backend wiring (the critical edges)

| User action | Page | Calls | Lands on |
|---|---|---|---|
| Sign in | `/auth/login` | `POST /api/auth/login` | `/onboarding` or `next` |
| Finish onboarding | `/onboarding` | `POST /api/learner/...` | `/dashboard` |
| Start a topic | `/explore` | `POST /api/search/build-path` | `/learning/{topic}/0` |
| Watch + answer | `/learning/{id}/{i}` | `youtube`,`summary`,`quizzes`,`progress` | next index / QuizModal |
| Build path from concept | `/concepts/{id}` | `POST /api/adaptive-paths` | `/paths/{id}` |
| Build study path from exam | `/exams` | `POST /api/exams/tracks/{id}/build-path` | `/paths/{id}` |
| Take mock exam | `/exams/mock/{id}` | `exams` mock endpoints | scored result |
| Clear review | `/review` | `quizzes` review/due endpoints | `/dashboard` |
| Upload material | `/upload` | `POST /api/content/upload` | `/content/{id}` |
| Generate notes | `/notes` | `notes` endpoints | `/notes/{youtubeId}` |
| Upgrade plan | `/billing` | `subscriptions`,`features` | `/payment` |

---

## 7. Recommended next steps (to make the flow coherent)

In rough priority order — these are *navigation/UX* fixes, not new features:

1. **Fix the re-login bug** (§2 bug #1 + #2). Biggest perceived-quality win.
2. **Fix the Vercel `NEXT_PUBLIC_API_URL`** to the Railway https URL (unblocks #1).
3. **Point the dashboard "Continue" CTA at the user's real active path**, not `/learning/demo/0`.
4. **Add role-aware nav** so teachers can reach `/teacher/*` and `/school/*` without typing URLs (mirror the Admin link pattern).
5. **Add a persistent search/"Learn something new" affordance** in the navbar so the learning loop is enterable from anywhere, not just the Explore tab.
6. **Retire or link `/courses/[courseId]`** — decide if it's still part of the product.
7. **De-duplicate Loyalty/Referral** between the More menu and the user menu.

---

*This document is descriptive of the current code. When flows change, update the
tree in §3 and the wiring table in §6 — they're the two parts people will read first.*
