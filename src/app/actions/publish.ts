'use server'

import { revalidatePath } from 'next/cache'
import { sendPost, cancelPost } from '@/lib/publishing/publish-service'

export async function publishPost(id: string, opts: { now?: boolean } = {}) {
  const res = await sendPost(id, opts)
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return res
}

export async function unpublishPost(id: string) {
  try {
    await cancelPost(id)
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Cancel failed' }
  }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}
