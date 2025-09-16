import { PriceCheckReminders } from "@/components/prices/price-check-reminders"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export default function PriceRemindersPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/prices">
              <ChevronLeft className="h-4 w-4" />
              Back to Prices
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-bold">Price Check Reminders</h1>
          <p className="text-muted-foreground">
            Set up automated reminders for price checks by retailer
          </p>
        </div>

        <PriceCheckReminders />
      </div>
    </div>
  )
}