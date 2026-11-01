import { AlarmClock, CheckCircle2, ClipboardList, Receipt, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import ComplaintTable from '../../components/ComplaintTable'
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { opsApi } from '../../services/api'
import { taka } from '../../utils/format'

export default function DeptDashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(async () => {
    const [stats, open] = await Promise.all([opsApi.deptStats(), opsApi.deptComplaints({ open: 'true', sort: 'priority', limit: 6 })])
    return { data: { ...stats.data, open: open.data } }
  }, [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const c = data.counts
  const max = Math.max(1, ...data.byCategory.map((x) => x.count))

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={`${data.department} department`} subtitle={`Welcome, ${user.name}. Facilities issues in your department's labs and rooms.`} />

      {data.waitingForMe > 0 && (
        <Link to="/approvals" className="card flex items-center gap-3 border-sky-200 bg-sky-50 p-4 hover:bg-sky-100/60">
          <Receipt className="size-5 text-sky-700" aria-hidden="true" />
          <span className="text-sm text-sky-900">
            <strong>{data.waitingForMe}</strong> work order{data.waitingForMe > 1 ? 's' : ''} waiting for your approval
          </span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total complaints" value={c.total} icon={ClipboardList} tone="sky" />
        <StatCard label="Being worked on" value={c.inProgress} icon={Wrench} tone="blue" />
        <StatCard label="Overdue" value={data.overdue} icon={AlarmClock} tone={data.overdue ? 'red' : 'green'} />
        <StatCard label="Resolved" value={c.resolved} icon={CheckCircle2} tone="green" hint={`Parts spent: ${taka(data.repairCost)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-navy-900">Open issues by priority</h2>
            <Link to="/dept/complaints" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.open.length ? <ComplaintTable items={data.open} columns={{ staff: true }} /> : <EmptyState title="No open issues" message="Everything in your department is working." />}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-navy-900">By category</h2>
          <ul className="mt-4 space-y-3">
            {data.byCategory.map((x) => (
              <li key={x.category}>
                <div className="flex justify-between text-sm">
                  <span>{x.category}</span>
                  <span className="text-ink-soft tabular-nums">
                    {x.count} · {taka(x.cost)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-sky-500" style={{ width: `${(x.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
