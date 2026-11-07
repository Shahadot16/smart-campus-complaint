import { CheckCircle2, ClipboardList, Hammer, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import ComplaintTable from '../../components/ComplaintTable'
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { staffApi } from '../../services/api'

export default function StaffDashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(async () => {
    const [stats, open] = await Promise.all([staffApi.stats(), staffApi.complaints({ open: 'true', sort: 'priority', limit: 5 })])
    return { data: { counts: stats.data.counts, open: open.data } }
  }, [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const c = data.counts
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Your assigned maintenance work." />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total assigned" value={c.total} icon={ClipboardList} tone="sky" />
        <StatCard label="New assignments" value={c.byStatus.assigned || 0} icon={ListChecks} tone="amber" hint="Not started yet" />
        <StatCard label="In progress" value={c.byStatus.in_progress || 0} icon={Hammer} tone="blue" />
        <StatCard label="Resolved" value={c.resolved} icon={CheckCircle2} tone="green" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-900">Open tasks by priority</h2>
          <Link to="/staff/tasks" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {data.open.length ? <ComplaintTable items={data.open} /> : <EmptyState title="No open tasks" message="You're all caught up." />}
      </div>
    </div>
  )
}
