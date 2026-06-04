"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  Tags,
  GitCompareArrows,
  LineChart,
  Settings,
} from "lucide-react"

interface MainNavProps {
  className?: string
  setOpen?: (open: boolean) => void
}

const NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { title: "Products", href: "/dashboard/products", icon: Package, match: ["/dashboard/products"] },
  { title: "Prices", href: "/dashboard/prices", icon: Tags, match: ["/dashboard/prices"] },
  { title: "Comparison", href: "/dashboard/comparison", icon: GitCompareArrows, match: ["/dashboard/comparison"] },
  { title: "Analytics", href: "/dashboard/analytics", icon: LineChart, match: ["/dashboard/analytics"] },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, match: ["/dashboard/settings"] },
] as const

export function MainNav({ className, setOpen }: MainNavProps) {
  const pathname = usePathname()

  const isActive = (item: (typeof NAV)[number]) =>
    item.match.some((m) => pathname === m || (m !== "/dashboard" && pathname.startsWith(m)))

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {NAV.map((item) => {
        const Icon = item.icon
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen?.(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
