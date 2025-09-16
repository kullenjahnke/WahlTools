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
        <Button variant="ghost" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] sm:w-[300px]">
        <SheetTitle className="text-left">Navigation</SheetTitle>
        <div className="px-1 py-6 space-y-6">
          <WahltoolsLogo className="h-8 w-auto" />
          <MainNav className="flex flex-col space-y-3" setOpen={setOpen} />
        </div>
      </SheetContent>
    </Sheet>
  )
} 