# Price-Entry Overhaul — Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make weekly manual price entry fast and pleasant, plus related improvements, across 5 phased, individually-previewable deliverables.

**Spec:** `docs/superpowers/specs/2026-06-07-price-entry-overhaul-design.md`

**Branch:** `feature/price-entry-overhaul` — one **draft PR**, one commit per phase.

## Verification model (read first)

This is a Next.js 15 app with **no test runner** (`package.json` scripts: `dev`, `build`, `start`, `lint`). Per the project owner's workflow, each task verifies with:

```bash
pnpm lint          # must pass clean
pnpm build         # must compile (set placeholder NEXT_PUBLIC_SUPABASE_* in .env.local to build offline)
```

…and each **phase** ends by pushing to the draft PR and **pausing for the owner's Vercel-preview review** before the next phase starts. Pure functions (Phase 0) include worked input/output examples in lieu of unit tests; if a `vitest` runner is later added, convert those examples to tests.

## Phase order & files

| Phase | Plan file | Visible? | Depends on |
|-------|-----------|----------|------------|
| 0 — Foundations | `2026-06-07-phase-0-foundations.md` | No (plumbing) | — |
| 1 — Record Prices | `2026-06-07-phase-1-record-prices.md` | First preview | 0 |
| 2 — Sequential | `2026-06-07-phase-2-sequential.md` | Yes | 0, (1 shared bits) |
| 3 — Export | `2026-06-07-phase-3-export.md` | Yes | — |
| 4 — Investigations | `2026-06-07-phase-4-investigations.md` | Yes | — |

## Shared conventions

- **Design system:** wrap pages in `PageContainer` + `PageHeader`; use `Chip`, `IconButton`, `RowActions`; lucide-react icons; Inter Tight; `--brand` green; **design light + dark**.
- **Brand palette** (Phase 3 headers + Phase-1/2 brand chips already use `Chip` brand tone): Wahlburgers `#44B549`, Catelli `#2563EB`, Grillo's `#F59E0B`, Schweid & Sons `#E11D48`.
- **Retailer order:** always via `orderRetailers` (Phase 0).
- **Saving prices:** always via `recordRetailerPrices` (Phase 0). Never write to `prices` directly from components.
- **Commit messages** end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Per-phase exit checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] Commit on `feature/price-entry-overhaul`, push, draft PR updated
- [ ] **Owner reviews Vercel preview and approves** before next phase
