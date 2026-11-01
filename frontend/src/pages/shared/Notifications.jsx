import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { commonApi, errorMessage } from '../../services/api'
import { formatDateTime, timeAgo } from '../../utils/format'

export default function Notifications() {
  const navigate = useNavigate()
  const { refreshUnread } = useOutletContext() || {}
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, meta, loading, error, reload, setData } = useApi(
    () => commonApi.notifications({ page, unread: unreadOnly ? 'true' : undefined }),
    [page, unreadOnly]
  )

  async function open(n) {
    if (!n.isRead) {
      setData((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)))
      commonApi.markRead(n._id).then(refreshUnread).catch(() => {})
    }
    if (n.complaint) navigate(`/complaints/${n.complaint}`)
  }

  async function markAll() {
    try {
      await commonApi.markAllRead()
      toast.success('All caught up')
      refreshUnread?.()
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={meta ? `${meta.unread} unread` : undefined}
        actions={
          meta?.unread > 0 && (
            <button className="btn-secondary" onClick={markAll}>
              <CheckCheck className="size-4" /> Mark all read
            </button>
          )
        }
      />
      <div className="card overflow-hidden">
        <div className="flex gap-1 border-b border-line p-2">
          {[
            [false, 'All'],
            [true, 'Unread'],
          ].map(([v, label]) => (
            <button
              key={label}
              className={`btn btn-sm ${unreadOnly === v ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-50'}`}
              onClick={() => {
                setUnreadOnly(v)
                setPage(1)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data.length ? (
          <EmptyState icon={Bell} title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} message="Updates on your complaints will show up here." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {data.map((n) => (
                <li key={n._id}>
                  <button onClick={() => open(n)} className={`flex w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/40'}`}>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-500'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.isRead ? 'text-ink' : 'font-semibold text-navy-900'}`}>{n.title}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">{n.message}</span>
                      <span className="mt-1 block text-xs text-ink-muted" title={formatDateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
