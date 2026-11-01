import { AlertTriangle, CheckCircle2, ClipboardList, Clock, RotateCcw, Star, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import ComplaintTable from '../../components/ComplaintTable'
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi } from '../../services/api'
import { formatHours } from '../../utils/format'

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(async () => {
    const [reports, urgent, unassigned, reopen] = await Promise.all([
      adminApi.reports(),
      adminApi.complaints({ sort: 'priority', open: 'true', limit: 5 }),
      adminApi.complaints({ assignedStaff: 'unassigned', status: 'submitted', limit: 1 }),
      adminApi.complaints({ reopenRequested: 'true', limit: 1 }),
    ])
    return {
      data: {
        reports: reports.data,
        urgent: urgent.data,
        unassignedNew: unassigned.meta.total,
        reopen: reopen.meta.total,
      },
    }
  }, [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { counts, resolution, feedback, byCategory } = data.reports
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count))

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Admin dashboard" subtitle="Campus-wide complaint overview." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total complaints" value={counts.total} icon={ClipboardList} tone="sky" />
        <StatCard label="Pending review" value={counts.pending} icon={Clock} tone="amber" />
        <StatCard label="In progress" value={counts.inProgress} icon={Wrench} tone="blue" />
        <StatCard label="Resolved" value={counts.resolved} icon={CheckCircle2} tone="green" hint={`Avg. resolution ${formatHours(resolution.avgHours)}`} />
      </div>

      {(data.unassignedNew > 0 || data.reopen > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.unassignedNew > 0 && (
            <Link to="/admin/complaints?status=submitted" className="card flex items-center gap-3 border-amber-200 bg-amber-50 p-4 hover:bg-amber-100/60">
              <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
              <span className="text-sm text-amber-900">
                <strong>{data.unassignedNew}</strong> new complaint{data.unassignedNew > 1 ? 's' : ''} waiting for review
              </span>
            </Link>
          )}
          {data.reopen > 0 && (
            <Link to="/admin/complaints?reopenRequested=true" className="card flex items-center gap-3 border-violet-200 bg-violet-50 p-4 hover:bg-violet-100/60">
              <RotateCcw className="size-5 text-violet-600" aria-hidden="true" />
              <span className="text-sm text-violet-900">
                <strong>{data.reopen}</strong> reopen request{data.reopen > 1 ? 's' : ''} pending
              </span>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-navy-900">Most urgent open complaints</h2>
            <Link to="/admin/complaints?sort=priority" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.urgent.length ? <ComplaintTable items={data.urgent} columns={{ staff: true }} /> : <EmptyState title="No open complaints" message="Everything is resolved. 🎉" />}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-navy-900">By category</h2>
            {byCategory.length ? (
              <ul className="mt-4 space-y-3">
                {byCategory.slice(0, 6).map((c) => (
                  <li key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink">{c.category}</span>
                      <span className="font-medium text-ink-soft tabular-nums">{c.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No data yet.</p>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-navy-900">Student satisfaction</h2>
            <div className="mt-3 flex items-center gap-3">
              <Star className="size-8 fill-amber-400 text-amber-400" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold text-navy-900">{feedback.average ?? '—'}<span className="text-sm font-normal text-ink-muted"> / 5</span></p>
                <p className="text-xs text-ink-muted">{feedback.count} rating{feedback.count === 1 ? '' : 's'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
