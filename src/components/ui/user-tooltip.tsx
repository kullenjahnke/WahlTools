'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTimeAgo, getUserInitials } from "@/lib/auth/get-user"

interface UserTooltipProps {
  email?: string | null
  timestamp?: string | null
  action?: 'created' | 'updated'
  children: React.ReactNode
}

export function UserTooltip({ email, timestamp, action = 'created', children }: UserTooltipProps) {
  if (!email && !timestamp) {
    return <>{children}</>
  }

  const timeAgo = timestamp ? formatTimeAgo(timestamp) : null
  const initials = email ? getUserInitials(email) : null
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {email && (
            <div className="flex items-center gap-1">
              <span className="font-medium">{initials}</span>
              <span className="text-muted-foreground">
                {action === 'created' ? 'added' : 'updated'} this
              </span>
            </div>
          )}
          {timeAgo && (
            <div className="text-muted-foreground">
              {timeAgo}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}