"use client"

import { useTheme } from "next-themes"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { BadgeCheck, KeyRound, Mail, Monitor, Moon, Sun } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
})
type EmailValues = z.infer<typeof emailSchema>

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  })
type PasswordValues = z.infer<typeof passwordSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccountSettingsProps {
  email: string
}

// ---------------------------------------------------------------------------
// Email card
// ---------------------------------------------------------------------------

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const supabase = createClientClient()
  const { toast } = useToast()

  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: EmailValues) {
    const { error } = await supabase.auth.updateUser({ email: values.email })
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Confirmation sent",
        description: `A confirmation email was sent to ${values.email}. Click the link to confirm your new address.`,
      })
      form.reset()
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Current email
          </p>
          <p className="text-sm font-medium text-foreground">{currentEmail || "—"}</p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Change email
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="new@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Sending…" : "Send confirmation"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Password card
// ---------------------------------------------------------------------------

function PasswordCard() {
  const supabase = createClientClient()
  const { toast } = useToast()

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  })

  async function onSubmit(values: PasswordValues) {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({ title: "Password updated" })
      form.reset()
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Min 8 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repeat password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Appearance card
// ---------------------------------------------------------------------------

type ThemeOption = { value: string; label: string; icon: React.ReactNode }

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
]

function AppearanceCard() {
  const { theme, setTheme } = useTheme()

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4 text-muted-foreground" />
          Appearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                theme === opt.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Authorized status card
// ---------------------------------------------------------------------------

function AuthorizedCard() {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          Access
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <BadgeCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          This account is authorized.
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Access is managed by an administrator.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function AccountSettings({ email }: AccountSettingsProps) {
  return (
    <div className="max-w-xl space-y-4">
      <EmailCard currentEmail={email} />
      <PasswordCard />
      <AppearanceCard />
      <AuthorizedCard />
    </div>
  )
}
