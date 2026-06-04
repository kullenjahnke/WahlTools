import { NextRequest, NextResponse } from "next/server"
import { shouldSendReminder } from "@/lib/email/schedule"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  // Guard against a missing secret so an unset env var can't be matched by
  // `Bearer undefined` and turn into an auth bypass.
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  if (!shouldSendReminder(new Date())) {
    // Not the 9 AM Wednesday Detroit window — the other weekly cron will handle it.
    return new NextResponse(null, { status: 204 })
  }

  try {
    const result = await sendPriceReminder()
    return NextResponse.json({ sent: true, id: result.id })
  } catch (error) {
    console.error("price-reminder cron failed:", error)
    return new NextResponse("Send failed", { status: 500 })
  }
}
