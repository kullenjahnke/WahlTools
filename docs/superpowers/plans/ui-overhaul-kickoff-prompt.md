# UI Overhaul — Kickoff Prompt

Copy everything in the fenced block below into a **new Claude Code session** opened in this repo to execute the UI overhaul. It loads the right context, skills, and connections.

> Prerequisite: make sure the `wahltools-review-fixes` branch (cron/middleware fix) has been merged to `main` first, so the new work branches off the corrected code.

---

```
I'm overhauling the UI of WahlTools — a Next.js 15 (App Router) + TypeScript + Supabase pricing platform, deployed on Vercel. I want a polished, production-grade redesign. Please use the Superpowers plugin and the frontend-design skill throughout, and use the Mobbin connection for real UI references.

READ FIRST (these are the source of truth — follow them exactly):
- Design spec:  docs/superpowers/specs/2026-06-04-ui-overhaul-design.md
- Implementation plan: docs/superpowers/plans/2026-06-04-ui-overhaul.md
These live on the `wahltools-ui-overhaul-plan` branch. Check that branch out (or cherry-pick/merge the two docs) so you can read them, then branch the actual work off the latest `main`.

SKILLS TO USE:
- superpowers:executing-plans (or superpowers:subagent-driven-development) to execute the plan task-by-task with review checkpoints. The plan is already written and approved — do NOT re-brainstorm or rewrite it; execute it.
- anthropic-skills:frontend-design — apply it for high design quality on every component/page; the plan sets direction, this skill raises the craft.
- superpowers:verification-before-completion — verify (build + lint + light/dark visual check) before claiming any phase done.
- superpowers:requesting-code-review — run a review before the final merge.
- Use the Mobbin connection (search_screens / search_flows, platform: web) to pull concrete references as you build each surface. Anchor references already chosen in the spec: Neon & Supabase (dashboard/sidebar), Fey & Midday (compact data tables), SavvyCal & Square (modals).

LOCKED DESIGN DECISIONS (from the spec — do not redecide):
- Aesthetic: Linear/Vercel minimal — monochrome neutrals, hairline borders, generous whitespace, color only for meaning.
- Brand: monochrome black/white base + green accent #44B549 (token name `--brand`, kept SEPARATE from shadcn's neutral `--accent`). Reserve green for primary actions / active states.
- Navigation: collapsible left sidebar (replacing the current top nav) + a slim top bar with the theme toggle.
- Dark mode: next-themes, defaultTheme="system", manual toggle, persisted; driven entirely by tokens.
- Density: compact / data-dense tables.
- Typography: Inter Tight via next/font/google (the current globals.css has a stray `body { font-family: Arial }` rule that overrides the font — remove it). Tighter heading letter-spacing, tuned line-heights, tabular-nums for price columns.
- Price deltas: NEUTRAL directional treatment (▲/▼ + muted text), NOT red/green good-bad — the user is not the consumer.

APPROACH: token-first refactor on the existing shadcn/Radix base (redefine CSS-variable tokens + Tailwind theme, restyle shared primitives once, then sweep pages). Don't replace the component library. Concrete token CSS is in the plan.

GROUND RULES:
- Work on a feature branch off the latest `main`; commit at the end of each phase; do NOT merge to `main` without my explicit approval.
- Preserve all existing functionality and data flows — this is a visual/structural restyle, not a feature change.
- Verify every phase with `pnpm build` + `pnpm lint` and a manual light AND dark visual check (`pnpm dev`). There is no test framework (out of scope) — do not add one.
- Stop at the end of each plan phase for my review before continuing. Show me screenshots/the running app where useful.
- Brand assets already exist: favicon set + email logo in /public; the wordmark SVG is at /Users/kullen/Desktop/wahltools-logo.svg; the gear mark is the favicon.

Start by reading the spec and plan, confirm your understanding back to me, then begin Phase 1 (Foundation: tokens, Inter Tight, next-themes). Ask me anything you need before proceeding.
```

---

## Why this prompt works
- **Points at the spec + plan** as the source of truth (so the new session doesn't re-derive decisions or drift).
- **Names the exact skills** and tells it to *execute* (not re-plan), which avoids wasted brainstorming.
- **Locks the subjective decisions** you already made (aesthetic, brand, sidebar, dark mode, density, font, delta colors) so the model can't substitute its own taste — your stated concern.
- **Wires in Mobbin** with the specific reference apps already chosen.
- **Carries the ground rules** (branch, per-phase checkpoints, verify in light/dark, no functionality change, no test framework) so it behaves like this engagement did.
- **Flags the Arial gotcha** and the `--brand` vs `--accent` token separation so it doesn't trip on them.
