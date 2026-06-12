"use client"

import { forwardRef } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import { Package, Tags } from "lucide-react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { cn } from "@/lib/utils"

export const EXPORT_CARD_WIDTH = 760

export interface ExportSeries {
  key: string
  label: string
  color: string
}

export interface ExportMetric {
  key: string
  label: string
  color: string
  avg: number | null
  wowChange: number | null
}

export type ExportHeader =
  | { kind: "product"; productName: string; brandName: string | null; imageDataUrl: string | null }
  | { kind: "comparison"; title: string; subtitle: string; icon: "product" | "category" }

export interface ChartExportCardProps {
  header: ExportHeader
  /** Theme-adaptive WahlTools logo data URL for the footer, or null to fall back to text. */
  logoDataUrl: string | null
  /** Short range label for the pill, e.g. "90 days". */
  rangeLabel: string
  /** Footer line, e.g. "Generated Jun 9, 2026". */
  generatedLabel: string
  series: ExportSeries[]
  metrics: ExportMetric[]
  chartData: Array<Record<string, string | number>>
}

export const ChartExportCard = forwardRef<HTMLDivElement, ChartExportCardProps>(
  function ChartExportCard(
    { header, logoDataUrl, rangeLabel, generatedLabel, series, metrics, chartData },
    ref
  ) {
    const chart = useChartTheme()

    return (
      <div
        ref={ref}
        style={{ width: EXPORT_CARD_WIDTH }}
        className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
      >
        <div className="flex">
          {/* Left: product + metrics */}
          <div className="w-[37%] border-r border-border p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {header.kind === "product" ? (
                  header.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={header.imageDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )
                ) : header.icon === "category" ? (
                  <Tags className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                {header.kind === "product" ? (
                  <>
                    <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                      {header.productName}
                    </div>
                    {header.brandName && (
                      <div className="text-xs text-muted-foreground">{header.brandName}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                      {header.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{header.subtitle}</div>
                  </>
                )}
              </div>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="border-b border-border py-1 pr-2 text-left font-medium">Retailer</th>
                  <th className="border-b border-border px-2 py-1 text-right font-medium">Avg</th>
                  <th className="border-b border-border py-1 pl-2 text-right font-medium">WoW</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.key}>
                    <td className="border-b border-border/60 py-1.5 pr-2">
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="align-middle">{m.label}</span>
                    </td>
                    <td className="border-b border-border/60 px-2 py-1.5 text-right tabular-nums">
                      {m.avg != null ? `$${m.avg.toFixed(2)}` : "—"}
                    </td>
                    <td
                      className={cn(
                        "border-b border-border/60 py-1.5 pl-2 text-right tabular-nums",
                        m.wowChange == null
                          ? "text-muted-foreground"
                          : m.wowChange < -0.1
                            ? "text-emerald-600 dark:text-emerald-400"
                            : m.wowChange > 0.1
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                      )}
                    >
                      {m.wowChange != null
                        ? `${m.wowChange > 0 ? "+" : ""}${m.wowChange.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: chart */}
          <div className="flex-1 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold">Prices</span>
              <span className="rounded-full bg-brand-muted px-2.5 py-0.5 text-[10px] font-semibold text-brand">
                {rangeLabel}
              </span>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), "MMM d")}
                    stroke={chart.axis}
                    tick={{ fill: chart.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chart.grid }}
                    minTickGap={32}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    stroke={chart.axis}
                    tick={{ fill: chart.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chart.grid }}
                    width={56}
                    domain={["auto", "auto"]}
                  />
                  {series.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
          <span>{generatedLabel}</span>
          <span className="flex items-center gap-1.5">
            <span>Powered by</span>
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="WahlTools" className="h-4 w-auto" />
            ) : (
              <span className="font-semibold text-brand">WahlTools</span>
            )}
          </span>
        </div>
      </div>
    )
  }
)
