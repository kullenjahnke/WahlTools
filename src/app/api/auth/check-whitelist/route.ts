import { NextResponse } from 'next/server'
import { isEmailAuthorized } from '@/lib/auth/whitelist'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    const isAuthorized = isEmailAuthorized(email)
    
    return NextResponse.json({ 
      authorized: isAuthorized,
      message: isAuthorized 
        ? 'Email is authorized' 
        : 'This email is not authorized to register'
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to check authorization' },
      { status: 500 }
    )
  }
}