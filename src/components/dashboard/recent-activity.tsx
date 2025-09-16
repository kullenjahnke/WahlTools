import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatTimeAgo, getUserInitials } from "@/lib/auth/get-user"
import { UserPlus, Package, DollarSign, Edit, Trash2 } from "lucide-react"

async function getRecentActivity() {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('Error fetching activity:', error)
    return []
  }
  
  return data
}

function getActivityIcon(action: string) {
  switch (action) {
    case 'create_product':
      return <Package className="h-4 w-4" />
    case 'update_product':
      return <Edit className="h-4 w-4" />
    case 'delete_product':
      return <Trash2 className="h-4 w-4" />
    case 'add_price':
      return <DollarSign className="h-4 w-4" />
    case 'create_user':
      return <UserPlus className="h-4 w-4" />
    default:
      return <Edit className="h-4 w-4" />
  }
}

function getActionText(action: string, entityName?: string) {
  switch (action) {
    case 'create_product':
      return `created product "${entityName}"`
    case 'update_product':
      return `updated product "${entityName}"`
    case 'delete_product':
      return `deleted product "${entityName}"`
    case 'add_price':
      return `added price for ${entityName}`
    default:
      return `performed ${action}`
  }
}

export async function RecentActivity() {
  const activities = await getRecentActivity()
  
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => {
          const initials = getUserInitials(activity.user_email)
          const timeAgo = formatTimeAgo(activity.created_at)
          
          return (
            <div key={activity.id} className="flex items-start gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {getActivityIcon(activity.action)}
                  <span className="text-muted-foreground">
                    {getActionText(activity.action, activity.entity_name)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {timeAgo}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}