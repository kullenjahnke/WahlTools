'use client'

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { MainNav } from "./main-nav"
import { useState } from "react"
import { WahltoolsLogo } from "@/components/icons/wahltools-logo"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <WahltoolsLogo className="h-5 w-auto text-foreground" />
        </div>
        <div className="p-2">
          <MainNav setOpen={setOpen} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
