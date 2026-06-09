'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { CAPTION_MODELS, type SocialSettings } from '@/lib/config/social-settings'
import { saveSocialSettings } from '@/app/actions/social-settings'

export function SocialSettingsForm({ initial }: { initial: SocialSettings }) {
  const [brandVoice, setBrandVoice] = useState(initial.brand_voice)
  const [captionModel, setCaptionModel] = useState(initial.caption_model)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function handleSave() {
    setSaving(true)
    const res = await saveSocialSettings({ brand_voice: brandVoice, caption_model: captionModel })
    setSaving(false)
    if (!res.success) {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Could not save', description: res.error ?? 'Please try again.' })
      return
    }
    toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Settings saved', description: 'AI caption settings updated.' })
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">AI captions</h2>
        <p className="text-sm text-muted-foreground">Used by the &ldquo;Generate caption&rdquo; button in the post composer.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-voice">Brand voice</Label>
        <Textarea
          id="brand-voice"
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          rows={6}
          placeholder="Describe the tone, style, and any do’s/don’ts for captions (e.g. “Warm, family-first, a little playful. Mention real ingredients. Avoid hard-sell language.”). Leave blank for a generic on-brand voice."
        />
        <p className="text-xs text-muted-foreground">Guides every generated caption. Leave blank to use a generic on-brand voice.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="caption-model">Caption model</Label>
        <Select value={captionModel} onValueChange={setCaptionModel}>
          <SelectTrigger id="caption-model" className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CAPTION_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}
