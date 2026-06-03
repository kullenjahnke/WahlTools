import { Resend } from "resend"

// Lazily construct the client so a missing key fails at send time, not import time.
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set")
  }
  return new Resend(apiKey)
}
