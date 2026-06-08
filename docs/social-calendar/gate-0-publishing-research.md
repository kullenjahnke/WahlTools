# Gate 0 — Social Calendar Publishing-Integration Research & Recommendation

> **Status:** Decision document. v1 (the calendar + content management) does **not** depend on this
> outcome and must not touch the Meta API. This decision only governs **Phase 2** (real auto-publishing).
> **Date:** 2026-06-08

## TL;DR

- **The hard cost of publishing isn't code — it's Meta App Review + Business Verification.** Both are
  required if we talk to the Meta Graph API directly, and realistically add **2–6+ weeks** of opaque,
  iterative approval before a single real post can go out.
- **Third-party publishing APIs (Ayrshare, Late/Zernio) eliminate that entirely** — their already-approved
  Meta app holds the permissions, and our users connect via a one-click hosted OAuth flow. No Meta app, no
  App Review, no Business Verification, no 60-day token babysitting.
- **Scheduling is a solved, cheap problem** the moment we actually need it: **Supabase `pg_cron` + a
  poll-and-claim poller costs $0** and lands posts within ~1 minute of their scheduled time — plenty precise.
- **Recommendation:** For Phase 2, **publish via a third-party API (Ayrshare or Late/Zernio), and schedule
  with Supabase `pg_cron`.** Reserve a direct Meta integration only if a hard requirement later forces it.
- **For v1 (this build):** change nothing. The existing **daily Vercel cron is fine for reminders**;
  minute-level scheduling is only introduced when timed *posting* actually ships.

---

## 1. Direct Meta Graph API

**What it takes end-to-end**

- A **Meta Developer (Business) App** with the Instagram product + Facebook Login for Business.
- The IG account must be **Business/Creator**, **linked to a Facebook Page** the user administers
  (permissions flow through the Page; Page Publishing Authorization can silently block specific accounts).
- Scopes (all require **Advanced Access** → App Review): `instagram_basic` /
  `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
  `business_management`.
- **App Review + Business Verification** are the real gate: business legal docs, a per-permission
  use-case justification, and a screencast — and you must make a **successful real publish call before
  approval** (chicken-and-egg). Wall-clock **2–6+ weeks**, frequently with rejection/resubmission cycles.
- **Token model:** short-lived → long-lived (~60-day) user token → Page token; must proactively refresh
  before expiry or posts silently stop going out.
- **Publishing:** IG is a **two-step container flow requiring a public media URL** (Meta fetches it);
  video/Reels need async status-polling before publish. FB Pages use `/feed`, `/photos`, `/videos`.
- **Formats:** single image, carousel (≤10, counts as one post), Reels, Stories — all API-publishable.
- **Rate limits:** ~100 API-published IG posts / rolling 24h (carousels = 1); query
  `content_publishing_limit` at runtime rather than hard-coding.
- **Scheduling:** **Facebook Pages support native scheduled posts** (`published=false` +
  `scheduled_publish_time`); **Instagram has NO native scheduling** — we must fire the publish ourselves
  at the target minute.

**Effort:** ~2–4 weeks engineering (single-tenant) **+ 2–6+ weeks review wall-clock** → ~4–8 weeks to go live.

**Biggest risks:** the approval gauntlet; 60-day token expiry as a permanent operational liability;
self-orchestrated IG scheduling; public-media-hosting requirement; ongoing scope/API churn.

## 2. Third-Party Publishing APIs

Vendors split into two camps: **"we are the Meta app"** (managed OAuth, no App Review for us) vs.
**"bring your own Meta app"** (self-host — does *not* remove the overhead).

| Vendor | API-first | Cheapest IG+FB API tier | Handles Meta OAuth + App Review? | Own Meta app? | Formats | Native scheduling | Notes |
|---|---|---|---|---|---|---|---|
| **Late / Zernio** | Yes | **Free** (2 accounts) | **Yes** | No | img, carousel, reel, story | Yes | Free tier = exactly 1 IG + 1 FB. Newer vendor; recently rebranded Late→Zernio. |
| **Ayrshare** | Yes | **$149/mo** Premium (1 profile = IG+FB) | **Yes** | No | img, carousel, reel, story | Yes (`scheduleDate`) | Most mature/proven; hosted JWT linking; white-label on Launch ($299). |
| **Postiz** (self-host) | Yes | Free SW + ~$5/mo infra | **No** | **Yes** | img, carousel, reel, story | Yes | OSS, data ownership — but **you still do Meta App Review yourself**. |
| **Publer** | Gated | $21/mo Business | Partial | No | img, carousel, reel, story | Yes | 50 req/min, no SLA, weaker dev docs. |
| **Buffer** | Effectively no | — | n/a | n/a | — | — | Public publishing API deprecated; new GraphQL is personal-key beta. Not viable. |

**Takeaway:** Late/Zernio (free) or Ayrshare ($149/mo) both remove **all** Meta-integration overhead.
Postiz only makes sense if self-hosting is a hard requirement (and then you own App Review anyway).

## 3. Scheduling Mechanism

Two architecture models matter more than the vendor:

- **Poll + claim (recommended):** a recurring job every N minutes `SELECT`s posts where
  `scheduled_at <= now() AND status='pending'`, atomically claims them (`UPDATE … RETURNING`), publishes.
  Self-healing (a missed tick is caught next minute), one moving part.
- **One-job-per-post:** register a one-off job (e.g. QStash `Upstash-Not-Before`) per post. Tighter
  timing, but you must create/cancel/reschedule jobs in lockstep with row edits.

| Option | Granularity | Cost (this tool) | Ops | Timing |
|---|---|---|---|---|
| Vercel Cron (Hobby — current) | **Daily only** | $0 | Trivial | ±59 min |
| Vercel Cron (Pro) | Per minute | $20/mo | Trivial | Best-effort/minute |
| **Supabase `pg_cron` + `pg_net`** | **Per minute** | **$0** | Low (SQL) | Reliable, in-DB |
| Upstash QStash | **Exact timestamp** | ~free at this scale | Medium | Purpose-built + retries |
| GitHub Actions cron | 5-min min | $0 | Low | ±5–30 min late — disqualified |
| Ayrshare owns scheduling | Exact | $49/mo+ | Lowest | Only worth it if also publishing via Ayrshare |

**Recommendation:** **Supabase `pg_cron` + poll-and-claim** — $0, lives next to the `scheduled_at` data,
reuses our service-role admin + atomic-RPC patterns, lands within ~1 min. QStash is the fallback if we
want exact-timestamp precision.

---

## Recommendation (Phase 2)

1. **Publish via a third-party API**, not the direct Meta integration — it deletes the single biggest
   risk (App Review + Business Verification + token lifecycle) for a tiny two-user internal tool.
   - **Late/Zernio (free)** is the lowest-cost, fastest-to-ship fit; caveat is vendor maturity/recent rebrand.
   - **Ayrshare ($149/mo)** is the safer, more proven choice if budget allows and we want stronger support.
   - Both share the same "no Meta app, hosted OAuth" model, so our integration code stays similar — easy
     to start on Late/Zernio and fall back to Ayrshare.
2. **Schedule with Supabase `pg_cron` + poll-and-claim** ($0), unless we adopt Ayrshare and let it own
   scheduling too.
3. **Only build a direct Meta integration** if a hard requirement later forces it (e.g. a feature no
   vendor supports, or a cost/scale inflection) — accepting the 4–8-week go-live and ongoing token ops.

## What this means for v1 (this session's build)

- **No Meta API, no third-party publishing API, no new scheduler.** v1 is the calendar + composer +
  tagging + media upload + status lifecycle + Resend reminders on the **existing daily cron**.
- The data model should keep a **`scheduled_at` timestamp**, an open-ended **status lifecycle**, and a
  **platform/account abstraction** so that whichever Phase-2 publishing path we pick drops in cleanly.

---

### Sources
Meta: [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) ·
[Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) ·
[App Review submission](https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide) ·
[Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/) ·
[Page scheduled_posts](https://developers.facebook.com/docs/graph-api/reference/page/scheduled_posts/).
Vendors: [Ayrshare pricing](https://www.ayrshare.com/pricing/) ·
[Ayrshare API](https://www.ayrshare.com/docs/apis/overview) ·
[Zernio/Late pricing](https://zernio.com/pricing) · [Zernio Instagram](https://zernio.com/instagram) ·
[Postiz IG docs](https://docs.postiz.com/providers/instagram) · [Publer plans](https://publer.com/plans) ·
[Buffer API rebuild](https://buffer.com/resources/rebuilding-buffers-api/).
Scheduling: [Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) ·
[Supabase schedule functions](https://supabase.com/docs/guides/functions/schedule-functions) ·
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) ·
[Supabase Cron](https://supabase.com/blog/supabase-cron) ·
[QStash delay](https://upstash.com/docs/qstash/features/delay) ·
[QStash pricing](https://upstash.com/pricing/qstash).
