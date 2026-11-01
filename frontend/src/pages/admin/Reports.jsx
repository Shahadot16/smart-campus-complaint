import { Download, Printer } from 'lucide-react'
import { useState } from 'react'
import { ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi } from '../../services/api'
import { PRIORITIES, STATUSES } from '../../utils/constants'
import { formatDate, formatHours } from '../../utils/format'

function BarList({ title, rows, color = 'bg-brand-500' }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="font-medium text-ink-soft tabular-nums">{r.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${r.color || color}`} style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No data for this period.</p>
      )}
    </div>
  )
}

function Trend({ trend }) {
  const max = Math.max(1, ...trend.map((t) => t.count))
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy-900">Complaints over time</h2>
      {trend.length ? (
        <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto" role="img" aria-label="Daily complaint counts">
          {trend.map((t) => (
            <div key={t.date} className="group flex min-w-4 flex-1 flex-col items-center justify-end gap-1" title={`${formatDate(t.date)}: ${t.count}`}>
              <span className="text-[10px] text-ink-muted opacity-0 group-hover:opacity-100">{t.count}</span>
              <div className="w-full rounded-t bg-brand-500 transition group-hover:bg-navy-800" style={{ height: `${(t.count / max) * 100}%`, minHeight: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No data for this period.</p>
      )}
      {trend.length > 0 && (
        <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
          <span>{formatDate(trend[0].date)}</span>
          <span>{formatDate(trend[trend.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}

function toCsv(r) {
  const lines = [['Section', 'Label', 'Count']]
  Object.entries(r.counts.byStatus).forEach(([k, v]) => lines.push(['Status', STATUSES[k]?.label || k, v]))
  Object.entries(r.byPriority).forEach(([k, v]) => lines.push(['Priority', PRIORITIES[k]?.label || k, v]))
  r.byCategory.forEach((c) => lines.push(['Category', c.category, c.count]))
  r.topBuildings.forEach((b) => lines.push(['Building', b.building, b.count]))
  r.staffPerformance.forEach((s) => lines.push(['Staff (total/open/resolved)', s.staff, `${s.total}/${s.open}/${s.resolved}`]))
  r.trend.forEach((t) => lines.push(['Daily', t.date, t.count]))
  return lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function AdminReports() {
  const [range, setRange] = useState({ from: '', to: '' })
  const { data, loading, error, reload } = useApi(
    () => adminApi.reports({ from: range.from || undefined, to: range.to || undefined }),
    [range.from, range.to]
  )

  function download() {
    const blob = new Blob([toCsv(data)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `complaint-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Complaint trends, workload and satisfaction."
        actions={
          data && (
            <>
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </button>
              <button className="btn-primary" onClick={download}>
                <Download className="size-4" /> Export CSV
              </button>
            </>
          )
        }
      />

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="r-from">From</label>
          <input id="r-from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="r-to">To</label>
          <input id="r-to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        {(range.from || range.to) && (
          <button className="btn-ghost" onClick={() => setRange({ from: '', to: '' })}>
            All time
          </button>
        )}
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total" value={data.counts.total} tone="sky" />
            <StatCard label="Resolved / closed" value={data.counts.resolved} tone="green" />
            <StatCard label="Avg. resolution time" value={formatHours(data.resolution.avgHours)} tone="violet" hint={`${data.resolution.resolvedCount} resolved`} />
            <StatCard label="Avg. rating" value={data.feedback.average ?? '—'} tone="amber" hint={`${data.feedback.count} ratings`} />
          </div>

          <Trend trend={data.trend} />

          <div className="grid gap-6 lg:grid-cols-3">
            <BarList
              title="By status"
              rows={Object.entries(data.counts.byStatus).map(([k, v]) => ({ label: STATUSES[k]?.label || k, count: v, color: STATUSES[k]?.dot }))}
            />
            <BarList
              title="By priority"
              rows={Object.keys(PRIORITIES)
                .filter((k) => data.byPriority[k])
                .map((k) => ({ label: PRIORITIES[k].label, count: data.byPriority[k], color: PRIORITIES[k].bar }))}
            />
            <BarList title="By category" rows={data.byCategory.map((c) => ({ label: c.category, count: c.count }))} />
            <BarList title="Top buildings" rows={data.topBuildings.map((b) => ({ label: b.building, count: b.count }))} color="bg-navy-700" />
            <BarList title="Rating distribution" rows={[...data.feedback.distribution].reverse().map((d) => ({ label: `${d.rating} ★`, count: d.count }))} color="bg-amber-400" />
          </div>

          <div className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-4 font-semibold text-navy-900">Staff performance</h2>
            {data.staffPerformance.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      <th className="table-head">Staff</th>
                      <th className="table-head text-right">Assigned</th>
                      <th className="table-head text-right">Open</th>
                      <th className="table-head text-right">Resolved</th>
                      <th className="table-head text-right">Resolution rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.staffPerformance.map((s) => (
                      <tr key={s.staff}>
                        <td className="table-cell font-medium">{s.staff || 'Unknown'}</td>
                        <td className="table-cell text-right tabular-nums">{s.total}</td>
                        <td className="table-cell text-right tabular-nums">{s.open}</td>
                        <td className="table-cell text-right tabular-nums">{s.resolved}</td>
                        <td className="table-cell text-right tabular-nums">{Math.round((s.resolved / s.total) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-ink-muted">No assignments in this period.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
