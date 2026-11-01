import { AlarmClock, CheckCircle2, Timer, TriangleAlert } from 'lucide-react'
import useNow from '../hooks/useNow'
import { formatDuration } from '../utils/format'

const CLOSED = ['resolved', 'closed', 'rejected']

/**
 * SLA state of a complaint: on track, due soon, overdue, met or missed.
 * `compact` shows a small chip for tables.
 */
export default function SlaBadge({ complaint, compact = false }) {
  const now = useNow()
  const sla = complaint?.sla
  if (!sla?.resolveDueAt || complaint.status === 'rejected') return compact ? <span className="text-xs text-ink-muted">—</span> : null

  const due = new Date(sla.resolveDueAt).getTime()
  const start = new Date(complaint.createdAt).getTime()

  let tone, Icon, text
  if (CLOSED.includes(complaint.status)) {
    const doneAt = new Date(complaint.resolvedAt || complaint.closedAt || now).getTime()
    const met = !sla.resolveBreached && doneAt <= due
    tone = met ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
    Icon = met ? CheckCircle2 : TriangleAlert
    text = met ? 'SLA met' : 'SLA missed'
  } else if (now > due) {
    tone = 'bg-red-50 text-red-700 ring-red-200'
    Icon = TriangleAlert
    text = `Overdue ${formatDuration(now - due)}`
  } else {
    const used = (now - start) / Math.max(due - start, 1)
    tone = used >= 0.8 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-50 text-slate-700 ring-slate-200'
    Icon = used >= 0.8 ? AlarmClock : Timer
    text = `${compact ? '' : 'Due in '}${formatDuration(due - now)}`
  }

  return (
    <span className={`chip ring-1 ring-inset ${tone}`} title={`Resolution due ${new Date(due).toLocaleString('en-GB')}`}>
      <Icon className="size-3" aria-hidden="true" />
      {text}
    </span>
  )
}
