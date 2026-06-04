import { NextRequest, NextResponse } from "next/server"
import { shouldSendReminder } from "@/lib/email/schedule"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
