import { ThemeToggle } from "@/components/theme/theme-toggle"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { MobileNav } from "@/components/layout/mobile-nav"

export function AppTopbar({ email }: { email?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {email && (
          <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
        )}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  )
}
