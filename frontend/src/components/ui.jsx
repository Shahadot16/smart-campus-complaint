import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'
import useCountUp from '../hooks/useCountUp'
import { PRIORITIES, STATUSES } from '../utils/constants'

export function Spinner({ className = 'size-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />
}

/** Counts up from 0 to a numeric value on mount; renders anything else as-is. */
export function AnimatedNumber({ value, className }) {
  const n = useCountUp(value)
  return <span className={className}>{n}</span>
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="animate-fade-in flex min-h-[40vh] flex-col items-center justify-center gap-4 text-ink-soft" role="status">
      <div className="relative grid place-items-center">
        <span className="animate-glow-pulse absolute size-12 rounded-full bg-brand-400/40 blur-xl" aria-hidden="true" />
        <Spinner className="relative size-8" />
      </div>
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

export function HeroBanner({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#1e1b4b_0%,#312e81_46%,#4f46e5_100%)] p-6 text-white shadow-pop sm:p-8">
      {/* drifting glow + faint grid for depth */}
      <div className="animate-glow-pulse pointer-events-none absolute -top-20 -right-10 size-64 rounded-full bg-indigo-400/30 blur-3xl" aria-hidden="true" />
      <div className="animate-aurora pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-9s]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:40px_40px]" aria-hidden="true" />
      <div className="absolute top-0 left-0 h-1 w-full bg-linear-to-r from-indigo-400 via-sky-300 to-indigo-400" aria-hidden="true" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {Icon && (
            <span className="animate-float hidden size-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm sm:grid">
              <Icon className="size-7 text-sky-300" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="animate-fade-in-up text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="animate-fade-in-up mt-1.5 text-sm text-indigo-100/85 [animation-delay:0.08s]">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="animate-fade-in-up relative flex flex-wrap gap-2 [animation-delay:0.16s]">{actions}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-gradient-brand text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STAT_TONES = {
  sky: { bar: 'from-sky-400 to-sky-600', chip: 'from-sky-500 to-sky-600', soft: 'bg-sky-500/10' },
  amber: { bar: 'from-amber-400 to-amber-600', chip: 'from-amber-500 to-amber-600', soft: 'bg-amber-500/10' },
  blue: { bar: 'from-blue-400 to-blue-600', chip: 'from-blue-500 to-blue-600', soft: 'bg-blue-500/10' },
  green: { bar: 'from-emerald-400 to-emerald-600', chip: 'from-emerald-500 to-emerald-600', soft: 'bg-emerald-500/10' },
  violet: { bar: 'from-violet-400 to-violet-600', chip: 'from-violet-500 to-violet-600', soft: 'bg-violet-500/10' },
  red: { bar: 'from-red-400 to-red-600', chip: 'from-red-500 to-red-600', soft: 'bg-red-500/10' },
}

export function StatCard({ label, value, icon: Icon, tone = 'sky', hint }) {
  const t = STAT_TONES[tone] || STAT_TONES.sky
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
      {/* top accent bar grows on hover */}
      <span className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-100 bg-linear-to-r transition-transform duration-300 ${t.bar}`} aria-hidden="true" />
      {/* faint tinted wash in the corner */}
      <span className={`pointer-events-none absolute -top-10 -right-10 size-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${t.soft} opacity-60`} aria-hidden="true" />
      <span className="sheen" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-soft">{label}</p>
          <p className="mt-2 text-[2rem] leading-none font-extrabold tracking-tight text-navy-900 tabular-nums">
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </p>
        </div>
        {Icon && (
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${t.chip}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {hint && <p className="relative mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="animate-float grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
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
      <div className="animate-fade-in absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`animate-scale-in relative w-full ${size} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}>
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

/** A university's logo, or a coloured monogram of its short name when it has none. */
export function BrandMark({ tenant, className = 'size-12', text = 'text-sm' }) {
  const b = tenant?.branding || {}
  if (b.logo) {
    return <img src={b.logo} alt={tenant?.shortName || ''} className={`${className} object-contain`} />
  }
  const initials = (tenant?.shortName || 'SC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
  return (
    <span className={`grid ${className} place-items-center rounded-2xl font-bold text-white ${text}`} style={{ background: b.primaryColor || '#0a4029' }}>
      {initials}
    </span>
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
