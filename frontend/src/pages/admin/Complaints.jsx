import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ComplaintList from '../../components/ComplaintList'
import { EmptyState, PageHeader } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, commonApi } from '../../services/api'

const TABS = [
  { key: '', label: 'All', count: (c) => c.total },
  { key: 'submitted', label: 'New', count: (c) => c.byStatus.submitted || 0 },
  { key: 'under_review', label: 'Under review', count: (c) => c.byStatus.under_review || 0 },
  { key: 'assigned', label: 'Assigned', count: (c) => c.byStatus.assigned || 0 },
  { key: 'in_progress', label: 'In progress', count: (c) => c.byStatus.in_progress || 0 },
  { key: 'resolved', label: 'Resolved', count: (c) => c.byStatus.resolved || 0 },
]

export default function AdminComplaints() {
  const [params, setParams] = useSearchParams()
  const [counts, setCounts] = useState(null)
  const { data: categories } = useApi(() => commonApi.categories({ all: 'true' }), [])
  const { data: staff } = useApi(() => adminApi.staff(), [])
  const status = params.get('status') || ''

  function selectTab(key) {
    const next = new URLSearchParams(params)
    if (key) next.set('status', key)
    else next.delete('status')
    next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="All complaints" subtitle="Review, assign and track every complaint on campus." />

      <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={status === t.key}
            onClick={() => selectTab(t.key)}
            className={`btn btn-sm rounded-full ${status === t.key ? 'bg-navy-900 text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:bg-slate-50'}`}
          >
            {t.label}
            {counts && <span className={`tabular-nums ${status === t.key ? 'text-brand-200' : 'text-ink-muted'}`}>{t.count(counts)}</span>}
          </button>
        ))}
      </div>

      <ComplaintList
        fetcher={adminApi.complaints}
        columns={{ student: true, staff: true }}
        categories={categories || []}
        staff={staff || []}
        showDates
        onMeta={(m) => m?.counts && setCounts(m.counts)}
        empty={<EmptyState title="No complaints yet" message="Complaints submitted by students will appear here." />}
      />
    </div>
  )
}
