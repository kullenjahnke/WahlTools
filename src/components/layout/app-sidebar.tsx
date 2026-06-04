"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { WahltoolsLogo } from "@/components/icons/wahltools-logo"
import { WahltoolsIcon } from "@/components/icons/wahltools-icon"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LayoutDashboard,
  Package,
  Tags,
  GitCompareArrows,
  LineChart,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"

const NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { title: "Products", href: "/dashboard/products", icon: Package, match: ["/dashboard/products"] },
  { title: "Prices", href: "/dashboard/prices", icon: Tags, match: ["/dashboard/prices"] },
  { title: "Comparison", href: "/dashboard/comparison", icon: GitCompareArrows, match: ["/dashboard/comparison"] },
  { title: "Analytics", href: "/dashboard/analytics", icon: LineChart, match: ["/dashboard/analytics"] },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, match: ["/dashboard/settings"] },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (item: (typeof NAV)[number]) =>
    item.match.some((m) => pathname === m || (m !== "/dashboard" && pathname.startsWith(m)))

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          <Link
            href="/dashboard"
            aria-label="WahlTools"
            className={cn(
              "flex items-center rounded-md text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed ? "w-full justify-center" : "px-1"
            )}
          >
            {collapsed ? (
              <WahltoolsIcon className="size-7" />
            ) : (
              <WahltoolsLogo className="h-5 w-auto" />
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            const link = (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-brand" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                  )}
                />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              )
            }
            return link
          })}
        </nav>

        {/* Collapse control */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 border-t border-sidebar-border px-4 py-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
    </TooltipProvider>
  )
}
