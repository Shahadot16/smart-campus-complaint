import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi'
import useDebounce from '../hooks/useDebounce'
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../utils/constants'
import ComplaintTable from './ComplaintTable'
import { EmptyState, ErrorState, PageLoader, Pagination } from './ui'

const FILTER_KEYS = ['status', 'priority', 'category', 'assignedStaff', 'sort', 'from', 'to', 'reopenRequested']

/**
 * Filterable, paginated complaint list. Filters live in the URL so lists are
 * shareable and survive a refresh. `fetcher(params)` returns an API envelope.
 */
export default function ComplaintList({ fetcher, columns, categories = [], staff, empty, onMeta, showDates }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') || '')
  const debouncedSearch = useDebounce(search)
  const page = Number(params.get('page')) || 1

  const query = { page, limit: 10 }
  for (const k of FILTER_KEYS) if (params.get(k)) query[k] = params.get(k)
  if (debouncedSearch.trim()) query.search = debouncedSearch.trim()
  const key = JSON.stringify(query)

  const { data, meta, loading, error, reload } = useApi(async () => {
    const res = await fetcher(query)
    onMeta?.(res.meta)
    return res
  }, [key])

  function update(k, v) {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const active = FILTER_KEYS.some((k) => params.get(k)) || search
  function clear() {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            className="input pl-9"
            placeholder="Search title, tracking ID, building…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (page !== 1) update('page', '')
            }}
            aria-label="Search complaints"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <select className="input sm:w-auto" value={params.get('status') || ''} onChange={(e) => update('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="input sm:w-auto" value={params.get('priority') || ''} onChange={(e) => update('priority', e.target.value)} aria-label="Priority">
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {categories.length > 0 && (
            <select className="input sm:w-auto" value={params.get('category') || ''} onChange={(e) => update('category', e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {staff && (
            <select
              className="input sm:w-auto"
              value={params.get('assignedStaff') || ''}
              onChange={(e) => update('assignedStaff', e.target.value)}
              aria-label="Assigned staff"
            >
              <option value="">Any staff</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select className="input sm:w-auto" value={params.get('sort') || 'newest'} onChange={(e) => update('sort', e.target.value === 'newest' ? '' : e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
            <option value="priority">Highest priority</option>
          </select>
        </div>
        {showDates && (
          <div className="flex items-center gap-2">
            <input type="date" className="input" value={params.get('from') || ''} onChange={(e) => update('from', e.target.value)} aria-label="From date" />
            <span className="text-xs text-ink-muted">to</span>
            <input type="date" className="input" value={params.get('to') || ''} onChange={(e) => update('to', e.target.value)} aria-label="To date" />
          </div>
        )}
        {active && (
          <button className="btn-ghost btn-sm" onClick={clear}>
            <X className="size-3.5" /> Clear
          </button>
        )}
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        active ? <EmptyState title="No matching complaints" message="Try changing or clearing the filters." /> : empty
      ) : (
        <div className={loading ? 'opacity-60 transition' : 'transition'}>
          <ComplaintTable items={data} columns={columns} />
          <Pagination meta={meta} onPage={(p) => update('page', String(p))} />
        </div>
      )}
    </div>
  )
}
