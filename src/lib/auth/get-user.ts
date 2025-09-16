import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  return user
}

export async function getCurrentUserEmail() {
  const user = await getCurrentUser()
  return user?.email || null
}

export function getUserInitials(email: string): string {
  if (!email) return '??'
  
  // For @arkkfood.com emails, use first letter of first name + first letter of last name
  if (email.includes('@arkkfood.com')) {
    const username = email.split('@')[0]
    const parts = username.split('.')
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    // For emails like "kdjahnke@arkkfood.com", extract K + J
    const match = username.match(/^([a-z]).*?([a-z])[^a-z]*$/i)
    if (match) {
      return (match[1] + match[2]).toUpperCase()
    }
  }
  
  // For other emails, use first two letters of username
  const username = email.split('@')[0]
  return username.substring(0, 2).toUpperCase()
}

export function formatTimeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}