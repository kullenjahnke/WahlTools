/**
 * Email whitelist configuration
 * Only these emails can register for new accounts
 */

// Get authorized emails from environment variable
const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(',').map(email => email.trim().toLowerCase()) || []

// Fallback hardcoded list in case env var is not set
const fallbackEmails = [
  'info@kullenjahnke.com',
  'kdjahnke@arkkfood.com',
  'rjahnke@arkkfood.com'
]

/**
 * Check if an email is authorized to register
 */
export function isEmailAuthorized(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  const whitelist = authorizedEmails.length > 0 ? authorizedEmails : fallbackEmails
  
  return whitelist.includes(normalizedEmail)
}

/**
 * Get list of authorized emails (for display purposes only)
 */
export function getAuthorizedEmails(): string[] {
  return authorizedEmails.length > 0 ? authorizedEmails : fallbackEmails
}