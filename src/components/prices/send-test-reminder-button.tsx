"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send } from "lucide-react"
import { sendTestPriceReminder } from "@/app/actions/reminders"

export function SendTestReminderButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleClick() {
    setLoading(true)
    const res = await sendTestPriceReminder()
    toast({
      title: res.ok ? "Sent" : "Error",
      description: res.message,
      variant: res.ok ? undefined : "destructive",
    })
    setLoading(false)
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={handleClick}>
      <Send className="h-4 w-4 mr-2" />
      {loading ? "Sending…" : "Send test reminder"}
    </Button>
  )
}
