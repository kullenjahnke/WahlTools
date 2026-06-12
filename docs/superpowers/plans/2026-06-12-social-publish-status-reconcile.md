# A2 — Publish Status Reconcile Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a published post's status converge to `posted` in real time and make it impossible for a successfully-published post to trigger a false "not posted" email.

**Architecture:** Two independent edits. (1) The Zernio webhook reads the post id from `payload.post.id` (Zernio's webhook shape) instead of the non-existent `payload.post._id`, restoring real-time status updates; plus boundary logging so silent misses are visible. (2) The daily cron runs the publish reconcile **before** the social "overdue" digest, so any due post that actually posted is flipped to `posted` and excluded from the digest.

**Tech Stack:** Next.js 15 route handlers, Supabase service-role admin client. No test runner — verification is `pnpm lint` + `pnpm build` plus manual smoke on the deployed build.

---

## Note on verification

No unit-test runner exists. Each task's gate is `pnpm lint` + `pnpm build` (both clean). The "failing
case" is established by reasoning against the real delivered payload (see spec). Final validation is
manual smoke on the deployed Vercel build (local Supabase creds are placeholders).

---

## File Structure

- **Modify** `src/app/api/webhooks/zernio/route.ts` — fix post-id extraction + add boundary logging.
- **Modify** `src/app/api/cron/price-reminder/route.ts` — move the reconcile block before the social
  digest block + add per-post reconcile logging.

The two files are independent; either task can land first.

---

## Task 1: Webhook — correct post id + boundary logging

**File:** Modify `src/app/api/webhooks/zernio/route.ts`.

- [ ] **Step 1: Widen the payload type to include `post.id`**

Change the payload type declaration (~line 25) from:

```ts
  let payload: { event?: string; post?: { _id?: string; platforms?: { status?: string; error?: string }[] } }
```

to:

```ts
  let payload: { event?: string; post?: { id?: string; _id?: string; platforms?: { status?: string; error?: string }[] } }
```

- [ ] **Step 2: Log the 401 on signature failure**

Change (~line 23):

```ts
  if (!verify(raw, sig)) return new NextResponse('Invalid signature', { status: 401 })
```

to:

```ts
  if (!verify(raw, sig)) {
    console.warn('zernio webhook: invalid signature — rejected (401)')
    return new NextResponse('Invalid signature', { status: 401 })
  }
```

- [ ] **Step 3: Read the post id from `id` (fallback `_id`) and log the no-id ignore**

Change (~lines 32-34):

```ts
  const event = payload.event ?? ''
  const vendorId = payload.post?._id
  if (!vendorId) return NextResponse.json({ ok: true, ignored: 'no post id' })
```

to:

```ts
  const event = payload.event ?? ''
  // Zernio's webhook payload carries the post id as `post.id`; REST response bodies use `_id`.
  // Prefer `id`, keep `_id` as a defensive fallback.
  const vendorId = payload.post?.id ?? payload.post?._id
  if (!vendorId) {
    console.warn('zernio webhook: ignored — no post id', { event })
    return NextResponse.json({ ok: true, ignored: 'no post id' })
  }
```

- [ ] **Step 4: Log the no-matching-post ignore**

Change (~line 42):

```ts
  if (!post) return NextResponse.json({ ok: true, ignored: 'no matching post' })
```

to:

```ts
  if (!post) {
    console.warn('zernio webhook: ignored — no matching post', { event, vendorId })
    return NextResponse.json({ ok: true, ignored: 'no matching post' })
  }
```

- [ ] **Step 5: Log the terminal status actions**

In the `post.published` / `post.partial` branch, after the `update(...).eq('id', p.id)` call (~line 49) add a log line; in the `post.failed` branch, after its `update(...).eq('id', p.id)` (~line 59) add a log line. The branch becomes:

```ts
  if (event === 'post.published' || event === 'post.partial') {
    await admin.from('social_posts').update({
      status: 'posted', posted_at: new Date().toISOString(), failure_reason: null, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    console.log('zernio webhook: marked posted', { event, vendorId, postId: p.id })
    if (p.external_ref?.croppedPaths?.length) await admin.storage.from(BUCKET).remove(p.external_ref.croppedPaths)
    if (event === 'post.partial') {
      const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Partially published'
      await notifyFailure(admin, p, `Partially published: ${reason}`)
    }
  } else if (event === 'post.failed') {
    const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Publish failed'
    await admin.from('social_posts').update({
      status: 'failed', failure_reason: reason, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    console.warn('zernio webhook: marked failed', { event, vendorId, postId: p.id, reason })
    await notifyFailure(admin, p, reason)
  }
```

- [ ] **Step 6: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean (no new errors/warnings).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/webhooks/zernio/route.ts
git commit -m "fix(social): read Zernio webhook post id from post.id (not post._id)

The webhook payload delivers the vendor post id at post.id; the handler read
post._id (which only REST response bodies use), so every post.published
delivery hit the silent 'no post id' branch and never updated status. Adds
boundary logging for the 401, both ignore branches, and the status updates.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Cron — reconcile before the social digest + reconcile logging

**File:** Modify `src/app/api/cron/price-reminder/route.ts`.

Current operational order is: (A) social digest [~lines 44-56], (B) weekly/follow-up/N-A [~lines 58-86], (C) reconcile [~lines 88-121], (D) asset cleanup [~lines 123-143]. We relocate block (C) to run immediately **before** block (A), and add per-post logging to it.

- [ ] **Step 1: Add per-post logging inside the reconcile loop**

In the reconcile block, inside the `for` loop, after `const st = await zernioAdapter.getStatus(vendorId)` add a log line, and log the "left scheduled" case. The loop body becomes:

```ts
      try {
        const st = await zernioAdapter.getStatus(vendorId)
        console.log('reconcile: getStatus', { postId: row.id, vendorId, status: st.status })
        if (st.status === "posted" || st.status === "partial") {
          await admin.from("social_posts").update({ status: "posted", posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id)
          const cp = (row.external_ref as { croppedPaths?: string[] } | null)?.croppedPaths
          if (cp?.length) await admin.storage.from('social-media').remove(cp)
          reconciled++
        } else if (st.status === "failed") {
          await admin.from("social_posts").update({ status: "failed", failure_reason: st.error ?? "Publish failed", updated_at: new Date().toISOString() }).eq("id", row.id)
          reconciled++
        }
      } catch (e) {
        console.error("reconcile getStatus failed for", row.id, e)
      }
```

(Only the one `console.log('reconcile: getStatus', …)` line is added; the rest of the loop is unchanged.)

- [ ] **Step 2: Relocate the reconcile block to run before the social digest**

Cut the **entire reconcile block** — the comment `// Reconcile: catch any publish results the webhook missed.` through its closing `}` of the `try/catch` (the block that ends with `actions.reconcileError = true` and its closing brace, ~lines 88-121) — and paste it **immediately above** the `// Social digest` block (currently ~line 44, the `try {` that calls `getUpcomingAndOverduePosts`).

After the move, the operational order inside `GET` is:
1. (relocated) Reconcile due posts → may flip status to `posted`/`failed`.
2. Social digest (`getUpcomingAndOverduePosts` → `sendSocialReminder`).
3. Weekly / follow-up / N-A digest (weekday-gated).
4. Asset cleanup.

Do not change the contents of any block other than the reconcile-loop log added in Step 1. Keep every block's existing `try/catch` and `actions.*` bookkeeping intact. The reconcile block references only `admin` (created earlier at ~line 31) and built-ins, so it is safe to run before the social digest.

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean. Confirm there is exactly one reconcile block (no duplicate/leftover) and the social digest now runs after it.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/price-reminder/route.ts
git commit -m "fix(social): run publish reconcile before the social overdue digest

Reconciling due posts to 'posted' before building the social digest prevents
a published-but-stale post from being emailed as 'not posted'. Adds per-post
getStatus logging to the reconcile loop.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (manual smoke — deployed build)

- [ ] Schedule a post a few minutes out; after Zernio publishes it, confirm status auto-flips to
      **posted** (webhook path) within seconds, with **no** overdue email.
- [ ] Confirm Vercel logs for `/api/webhooks/zernio` show `zernio webhook: marked posted` with the
      `vendorId`/`postId` for that delivery (and no `ignored — no post id`).
- [ ] For a past-due still-`scheduled` post that actually posted: confirm the cron run reconciles it
      to **posted** before the social digest, so it is **not** listed as overdue; Vercel logs show
      `reconcile: getStatus … status: 'posted'`.
- [ ] `pnpm lint` + `pnpm build` clean.
