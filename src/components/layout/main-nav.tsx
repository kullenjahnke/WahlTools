"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Home,
  Package,
  ShoppingBag,
  LineChart,
  Gauge
} from "lucide-react"

interface MainNavProps {
  className?: string
  setOpen?: (open: boolean) => void
}

export function MainNav({ className, setOpen }: MainNavProps) {
  const pathname = usePathname()

  const items = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: Home,
      match: [
        "/dashboard"
      ]
    },
    {
      title: "Products",
      href: "/dashboard/products",
      icon: Package,
      match: [
        "/dashboard/products",
        "/dashboard/products/new",
        "/dashboard/products/import",
        "/dashboard/products/urls"
      ]
    },
    {
      title: "Prices",
      href: "/dashboard/prices",
      icon: ShoppingBag,
      match: [
        "/dashboard/prices",
        "/dashboard/prices/check",
        "/dashboard/prices/history",
        "/dashboard/prices/bulk-update",
        "/dashboard/prices/reminders"
      ]
    },
    {
      title: "Analytics",
      href: "/dashboard/analytics",
      icon: LineChart,
      match: [
        "/dashboard/analytics"
      ]
    },
    {
      title: "Comparison",
      href: "/dashboard/comparison",
      icon: BarChart,
      match: [
        "/dashboard/comparison"
      ]
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: Gauge,
      match: [
        "/dashboard/settings"
      ]
    }
  ]

  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)}>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          item.match?.includes(pathname)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen?.(false)}
            className={cn(
              "flex items-center text-sm font-medium transition-colors hover:text-foreground",
              className?.includes("flex-col") ? "justify-start w-full" : "",
              isActive 
                ? "text-foreground" 
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4 mr-2" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}