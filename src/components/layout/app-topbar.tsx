import { MobileNav } from "@/components/layout/mobile-nav"
import { UserMenu } from "@/components/layout/user-menu"

export function AppTopbar({ email }: { email?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <UserMenu email={email} />
      </div>
    </header>
  )
}
