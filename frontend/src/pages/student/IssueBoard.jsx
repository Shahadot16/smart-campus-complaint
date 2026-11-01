import { Award, MapPin, Search, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination, PriorityBadge, StatusBadge } from '../../components/ui'
import { useLang } from '../../context/LanguageContext'
import useApi from '../../hooks/useApi'
import useDebounce from '../../hooks/useDebounce'
import MeTooButton from '../../components/MeTooButton'
import api from '../../services/api'
import { timeAgo } from '../../utils/format'

const board = (params) => api.get('/public/complaints', { params }).then((r) => r.data)
const leaderboard = () => api.get('/leaderboard').then((r) => r.data)

export default function IssueBoard() {
  const { t } = useLang()
  const [sort, setSort] = useState('votes')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search)
  const status = sort === 'resolved' ? 'resolved' : undefined
  const { data, meta, loading, error, reload } = useApi(() => board({ page, sort: sort === 'newest' ? 'newest' : undefined, status, search: q || undefined }), [page, sort, q])
  const top = useApi(leaderboard, [])

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('Campus issue board')} subtitle={t('Open problems reported by students. Say "me too" if it affects you — popular issues get priority.')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input className="input pl-9" placeholder={t('Search…')} value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} aria-label="Search" />
            </div>
            <div className="flex gap-1">
              {[
                ['votes', t('Most affected')],
                ['newest', t('Newest')],
                ['resolved', t('Recently fixed')],
              ].map(([k, label]) => (
                <button key={k} className={`btn btn-sm ${sort === k ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-50'}`} onClick={() => (setSort(k), setPage(1))}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && !data ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data.length ? (
            <div className="card">
              <EmptyState title="Nothing here" message="No public issues match." />
            </div>
          ) : (
            <>
              {data.map((c) => (
                <div key={c._id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {c.mine ? <Link to={`/complaints/${c._id}`} className="hover:underline">{c.title}</Link> : c.title}
                        {c.mine && <span className="chip ml-2 bg-brand-50 text-brand-700">Yours</span>}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <MapPin className="size-3" aria-hidden="true" /> {c.location?.building}
                        {c.location?.room ? `, ${c.location.room}` : ''} · {c.category?.name} · {timeAgo(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={c.priority} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{c.description}</p>
                  {sort !== 'resolved' && (
                    <div className="mt-3">
                      <MeTooButton complaint={c} />
                    </div>
                  )}
                </div>
              ))}
              <div className="card">
                <Pagination meta={meta} onPage={setPage} />
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          {[
            ['reporters', t('Top reporters this month'), Award, (r) => `${r.reports} reports · ${r.votes} votes`],
            ['fixers', t('Top fixers this month'), Trophy, (r) => `${r.fixed} fixed · ${r.onTime} on time`],
          ].map(([key, title, Icon, detail]) => (
            <div key={key} className="card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <Icon className="size-4 text-amber-500" aria-hidden="true" /> {title}
              </h2>
              <ol className="mt-3 space-y-2">
                {(top.data?.[key] || []).map((r, i) => (
                  <li key={r.name} className="flex items-center gap-2 text-sm">
                    <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-400 text-navy-950' : 'bg-slate-100 text-ink-soft'}`}>{i + 1}</span>
                    <span className="flex-1">
                      {r.name}
                      <span className="block text-[11px] text-ink-muted">{detail(r)}</span>
                    </span>
                    <span className="text-xs font-semibold text-brand-700">{r.points} pts</span>
                  </li>
                ))}
                {top.data && !top.data[key].length && <li className="text-xs text-ink-muted">No activity yet this month.</li>}
              </ol>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
