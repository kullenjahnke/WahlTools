"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

/**
 * Recharts color props become SVG presentation attributes, where `var(--token)`
 * does NOT resolve. This hook reads the design tokens off the document at runtime
 * and re-reads them when the theme changes, so charts stay token-driven in both
 * light and dark without hard-coded hex values.
 */
function readVar(name: string): string {
  if (typeof window === "undefined") return ""
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : ""
}

export interface ChartTheme {
  grid: string
  axis: string
  brand: string
  /** Monochrome-leaning categorical palette (brand as series-1). */
  series: string[]
  tooltipBg: string
  tooltipText: string
}

function computeChartTheme(): ChartTheme {
  return {
    grid: readVar("--border"),
    axis: readVar("--muted-foreground"),
    brand: readVar("--brand"),
    series: [
      readVar("--chart-1"),
      readVar("--chart-2"),
      readVar("--chart-3"),
      readVar("--chart-4"),
      readVar("--chart-5"),
    ],
    tooltipBg: readVar("--popover"),
    tooltipText: readVar("--popover-foreground"),
  }
}

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  const [theme, setTheme] = useState<ChartTheme>(() => computeChartTheme())

  useEffect(() => {
    setTheme(computeChartTheme())
  }, [resolvedTheme])

  return theme
}
