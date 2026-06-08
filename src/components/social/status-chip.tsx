import { Chip } from '@/components/ui/chip'
import { statusMeta } from '@/lib/config/social'

export function StatusChip({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const meta = statusMeta(status)
  return <Chip label={meta.label} tone={meta.tone} size={size} />
}
