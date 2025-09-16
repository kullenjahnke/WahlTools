"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { RETAILERS } from "@/lib/config/retailers"
import { Bell, Calendar } from "lucide-react"

interface ReminderSettings {
  retailer: string
  day_of_week: string
  enabled: boolean
  email_notifications: boolean
  notification_email?: string
}

export function PriceCheckReminders() {
  const [settings, setSettings] = useState<ReminderSettings[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClientClient()

  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_check_reminders')
      .select('*')

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load reminder settings",
        variant: "destructive"
      })
      return
    }

    // Initialize settings for any retailers that don't have them
    const existingRetailers = data.map(d => d.retailer)
    const defaultSettings = RETAILERS
      .filter(r => !existingRetailers.includes(r))
      .map(retailer => ({
        retailer,
        day_of_week: 'Monday',
        enabled: false,
        email_notifications: false
      }))

    setSettings([...data, ...defaultSettings])
  }, [supabase, toast])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateSetting = (retailer: string, field: keyof ReminderSettings, value: boolean | string | number) => {
    setSettings(prev => prev.map(setting => 
      setting.retailer === retailer 
        ? { ...setting, [field]: value }
        : setting
    ))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Delete existing settings
      await supabase.from('price_check_reminders').delete().neq('retailer', '')
      
      // Insert new settings
      const { error } = await supabase
        .from('price_check_reminders')
        .insert(settings)

      if (error) throw error

      toast({
        title: "Success",
        description: "Reminder settings saved successfully"
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Error",
        description: "Failed to save reminder settings",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Price Check Reminders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {settings.map(setting => (
            <div 
              key={setting.retailer}
              className="grid gap-6 border-b pb-6 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium">{setting.retailer}</h4>
                  <p className="text-sm text-muted-foreground">
                    Set reminder preferences for {setting.retailer} price checks
                  </p>
                </div>
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={(checked) => 
                    updateSetting(setting.retailer, 'enabled', checked)
                  }
                />
              </div>

              {setting.enabled && (
                <div className="grid gap-4 pl-4">
                  <div className="flex items-center gap-4">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={setting.day_of_week}
                      onValueChange={(value) => 
                        updateSetting(setting.retailer, 'day_of_week', value)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {daysOfWeek.map(day => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`email-${setting.retailer}`}
                        checked={setting.email_notifications}
                        onCheckedChange={(checked) => 
                          updateSetting(setting.retailer, 'email_notifications', checked)
                        }
                      />
                      <Label htmlFor={`email-${setting.retailer}`}>
                        Email notifications
                      </Label>
                    </div>

                    {setting.email_notifications && (
                      <Input
                        type="email"
                        placeholder="notification@example.com"
                        value={setting.notification_email || ''}
                        onChange={(e) => 
                          updateSetting(setting.retailer, 'notification_email', e.target.value)
                        }
                        className="max-w-md"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading}>
              Save Reminder Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}