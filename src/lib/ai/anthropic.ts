import Anthropic from '@anthropic-ai/sdk'

// Lazily construct the client so a missing key fails at call time, not import
// time — this keeps `pnpm build` green without ANTHROPIC_API_KEY set.
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey })
}
