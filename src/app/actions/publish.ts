'use server'

import { revalidatePath } from 'next/cache'
import { sendPost } from '@/lib/publishing/publish-service'

export async function publishPost(id: string, opts: { now?: boolean } = {}) {
  const res = await sendPost(id, opts)
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return res
}
