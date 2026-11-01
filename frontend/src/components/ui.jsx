import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'
import { PRIORITIES, STATUSES } from '../utils/constants'

export function Spinner({ className = 'size-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-soft" role="status">
      <Spinner className="size-7" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = STATUSES[status] || { label: status, className: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' }
  return (
    <span className={`chip ring-1 ring-inset ${s.className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const p = PRIORITIES[priority] || PRIORITIES.medium
  const level = Object.keys(PRIORITIES).indexOf(priority) + 1
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.className}`}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`w-1 rounded-sm ${i <= level ? p.bar : 'bg-slate-200'}`} style={{ height: 4 + i * 2 }} />
        ))}
      </span>
      {p.label}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STAT_TONES = {
  sky: 'bg-sky-50 border-sky-100',
  amber: 'bg-amber-50 border-amber-100',
  blue: 'bg-blue-50 border-blue-100',
  green: 'bg-emerald-50 border-emerald-100',
  violet: 'bg-violet-50 border-violet-100',
  red: 'bg-red-50 border-red-100',
}
const ICON_TONES = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
}

export function StatCard({ label, value, icon: Icon, tone = 'sky', hint }) {
  return (
    <div className={`rounded-xl border p-5 ${STAT_TONES[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        {Icon && (
          <span className={`grid size-9 place-items-center rounded-lg ${ICON_TONES[tone]}`}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertCircle className="size-8 text-red-500" aria-hidden="true" />
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) {
    return meta?.total ? (
      <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
        Showing {meta.total} result{meta.total === 1 ? '' : 's'}
      </p>
    ) : null
  }
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.total, meta.page * meta.limit)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-ink-muted">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 text-xs font-medium text-ink-soft">
          Page {meta.page} / {meta.totalPages}
        </span>
        <button
          className="btn-ghost btn-sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`animate-fade-in relative w-full ${size} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-900">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, htmlFor, required }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export function Avatar({ name = '', className = 'size-9 text-sm' }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 ${className}`} aria-hidden="true">
      {letters || '?'}
    </span>
  )
}
