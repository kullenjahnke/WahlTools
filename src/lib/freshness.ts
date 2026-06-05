// Shared price-freshness classification used by the Prices table, Dashboard,
// Comparison, and Analytics surfaces. A price is considered "active" when it has
// been updated recently, "stale" once it crosses the staleness threshold, and
// "discontinued" (likely no longer stocked) after a longer window.

export type FreshnessStatus = "active" | "stale" | "discontinued";

export const FRESHNESS_THRESHOLDS = {
  /** Days after which an un-updated price is considered stale. */
  staleDays: 14,
  /** Days after which an un-updated price is likely discontinued / not stocked. */
  discontinuedDays: 42,
} as const;

export interface FreshnessResult {
  status: FreshnessStatus;
  /** Whole days since the price was last updated (null when never updated). */
  days: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysSince(
  timestamp: string | number | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (timestamp == null) return null;
  const then = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((now.getTime() - ms) / MS_PER_DAY));
}

export function classifyFreshness(
  timestamp: string | number | Date | null | undefined,
  now: Date = new Date()
): FreshnessResult {
  const days = daysSince(timestamp, now);
  if (days == null) return { status: "discontinued", days: null };
  if (days >= FRESHNESS_THRESHOLDS.discontinuedDays)
    return { status: "discontinued", days };
  if (days >= FRESHNESS_THRESHOLDS.staleDays) return { status: "stale", days };
  return { status: "active", days };
}

export interface FreshnessMeta {
  status: FreshnessStatus;
  label: string;
  /** Tailwind classes for a chip/badge (theme-adaptive). */
  chipClass: string;
  /** Tailwind classes for a small status dot. */
  dotClass: string;
  /** Whether the row should be visually de-emphasised. */
  muted: boolean;
}

const FRESHNESS_META: Record<FreshnessStatus, Omit<FreshnessMeta, "status">> = {
  active: {
    label: "Active",
    chipClass: "bg-brand-muted text-brand",
    dotClass: "bg-brand",
    muted: false,
  },
  stale: {
    label: "Stale",
    chipClass:
      "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    dotClass: "bg-amber-500 dark:bg-amber-400",
    muted: true,
  },
  discontinued: {
    label: "Likely discontinued",
    chipClass:
      "bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground/60",
    muted: true,
  },
};

export function freshnessMeta(status: FreshnessStatus): FreshnessMeta {
  return { status, ...FRESHNESS_META[status] };
}
