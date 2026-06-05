import * as React from "react";
import { cn } from "@/lib/utils";

// A small, color-coded pill used for categories, brands, and other taxonomy.
// Colors are derived deterministically from the label so the same category
// always renders the same hue. Tones are literal class strings (Tailwind-safe)
// and adapt to light/dark mode.

const CHIP_TONES = [
  "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
  "bg-fuchsia-500/12 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
  "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  "bg-orange-500/12 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-pink-500/12 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
] as const;

const BRAND_TONE = "bg-brand-muted text-brand";
const NEUTRAL_TONE = "bg-muted text-muted-foreground";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function chipToneFor(key: string): string {
  if (!key) return NEUTRAL_TONE;
  return CHIP_TONES[hashString(key) % CHIP_TONES.length];
}

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode;
  /**
   * "auto" derives a stable color from `colorKey` (or the label).
   * "brand" uses the brand green. "neutral" uses muted. A raw class string
   * overrides entirely.
   */
  tone?: "auto" | "brand" | "neutral" | string;
  /** String used for the deterministic color when tone is "auto". */
  colorKey?: string;
  /** Show a leading color dot in the current text color. */
  dot?: boolean;
  size?: "sm" | "md";
}

export function Chip({
  label,
  tone = "auto",
  colorKey,
  dot = false,
  size = "md",
  className,
  ...props
}: ChipProps) {
  const toneClass =
    tone === "auto"
      ? chipToneFor(colorKey ?? (typeof label === "string" ? label : ""))
      : tone === "brand"
        ? BRAND_TONE
        : tone === "neutral"
          ? NEUTRAL_TONE
          : tone;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        toneClass,
        className
      )}
      {...props}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      )}
      {label}
    </span>
  );
}
