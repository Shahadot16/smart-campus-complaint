const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '—')
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—')

export function timeAgo(d) {
  if (!d) return ''
  const seconds = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size)
    if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

export const pad = (n) => String(n ?? 0).padStart(2, '0')

export const formatBytes = (b) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

export function formatHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h} h`
  return `${Math.round((h / 24) * 10) / 10} days`
}

/** "3h 20m" style duration from milliseconds. */
export function formatDuration(ms) {
  const mins = Math.max(0, Math.round(Math.abs(ms) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

/** Bangladeshi taka amount, e.g. ৳18,500 */
export const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`
