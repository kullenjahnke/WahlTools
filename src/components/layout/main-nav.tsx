"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Building,
  ChevronDown,
  CheckSquare,
  Home,
  Package,
  ShoppingBag,
  Link2,
  Users,
  LineChart,
  Gauge
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

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
          item.match?.includes(pathname) ||
          (item.children && item.children.some(child => child.href === pathname))

        // Items with children get a dropdown
        if (item.children) {
          return (
            <DropdownMenu key={item.href}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 px-2",
                    className?.includes("flex-col") ? "justify-start w-full" : "",
                    isActive 
                      ? "bg-muted font-medium text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.title}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align={className?.includes("flex-col") ? "center" : "start"} 
                className="w-48"
              >
                {item.children.map((child) => (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link 
                      href={child.href}
                      onClick={() => setOpen?.(false)}
                      className="flex items-center cursor-pointer"
                    >
                      <child.icon className="h-4 w-4 mr-2" />
                      {child.title}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        // Regular items just get a link
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