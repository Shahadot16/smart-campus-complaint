import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi } from '../../services/api'
import { formatDateTime, timeAgo } from '../../utils/format'

const ENTITIES = ['Complaint', 'User', 'Category']

const ACTION_STYLE = {
  create: 'bg-emerald-50 text-emerald-700',
  activate: 'bg-emerald-50 text-emerald-700',
  deactivate: 'bg-red-50 text-red-700',
  status: 'bg-blue-50 text-blue-700',
  assign: 'bg-sky-50 text-sky-700',
  priority: 'bg-amber-50 text-amber-800',
  update: 'bg-slate-100 text-slate-700',
}

export default function AuditLog() {
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useApi(() => adminApi.auditLogs({ page, entity: entity || undefined }), [page, entity])

  return (
    <div className="animate-fade-in">
      <PageHeader title="Audit log" subtitle="Every administrative action, who did it and when." />
      <div className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-line p-2">
          {['', ...ENTITIES].map((e) => (
            <button
              key={e || 'all'}
              className={`btn btn-sm ${entity === e ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-50'}`}
              onClick={() => {
                setEntity(e)
                setPage(1)
              }}
            >
              {e ? `${e}s` : 'All'}
            </button>
          ))}
        </div>
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data.length ? (
          <EmptyState icon={History} title="No actions recorded yet" message="Admin actions such as assigning staff or editing users will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {data.map((log) => {
                const verb = log.action.split('.')[1]
                return (
                  <li key={log._id} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar name={log.actor?.name || '?'} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{log.actor?.name || 'Unknown'}</span>{' '}
                        <span className={`chip ${ACTION_STYLE[verb] || ACTION_STYLE.update}`}>{log.action}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {log.entity === 'Complaint' && log.entityId ? (
                          <Link to={`/complaints/${log.entityId}`} className="hover:underline">
                            {log.summary}
                          </Link>
                        ) : (
                          log.summary
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-ink-muted" title={formatDateTime(log.createdAt)}>
                      {timeAgo(log.createdAt)}
                      {log.ip && <p className="font-mono">{log.ip}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
