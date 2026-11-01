import { Copy, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useDebounce from '../hooks/useDebounce'
import { aiApi } from '../services/api'
import { PRIORITIES } from '../utils/constants'
import { StatusBadge } from './ui'

/**
 * While a student types, suggests a category/priority and warns about
 * similar open complaints (possible duplicates).
 */
export default function SmartAssist({ form, building, categories, onApply }) {
  const draft = useDebounce({ title: form.title, description: form.description, building }, 700)
  const [suggestion, setSuggestion] = useState(null)
  const [similar, setSimilar] = useState([])
  const enough = draft.title.trim().length + draft.description.trim().length >= 15

  useEffect(() => {
    if (!enough) return
    let cancelled = false
    Promise.all([aiApi.classify(draft), aiApi.similar(draft)])
      .then(([c, s]) => {
        if (cancelled) return
        setSuggestion(c.data.categoryId && c.data.confidence > 0 ? c.data : null)
        setSimilar(s.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [draft, enough])

  const shown = enough ? suggestion : null
  const dupes = enough ? similar : []
  const alreadyApplied = shown && form.category === shown.categoryId && form.priority === shown.priority
  if (!shown && !dupes.length) return null

  return (
    <div className="space-y-3">
      {shown && !alreadyApplied && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-sm">
          <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
          <span className="text-ink-soft">Suggested:</span>
          <span className="chip bg-white text-ink ring-1 ring-line">{categories.find((c) => c._id === shown.categoryId)?.name || shown.category}</span>
          <span className={`chip bg-white ring-1 ring-line ${PRIORITIES[shown.priority]?.className}`}>{PRIORITIES[shown.priority]?.label} priority</span>
          <button type="button" className="btn-primary btn-sm ml-auto" onClick={() => onApply({ category: shown.categoryId, priority: shown.priority })}>
            Apply
          </button>
          <p className="w-full text-xs text-ink-muted">{shown.reason}</p>
        </div>
      )}
      {dupes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <Copy className="size-4" aria-hidden="true" /> Has someone already reported this?
          </p>
          <ul className="mt-2 space-y-1.5">
            {dupes.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-amber-100">
                <span className="font-mono text-xs text-navy-800">{d.trackingCode}</span>
                <span className="flex-1 text-ink">{d.title}</span>
                <StatusBadge status={d.status} />
                <span className="text-xs text-ink-muted">
                  {d.location?.building} · {Math.round(d.score * 100)}% match
                </span>
                {d.mine && (
                  <Link to={`/complaints/${d._id}`} className="text-xs font-medium text-brand-700 underline">
                    yours — open
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">If it's the same problem, you don't need to submit it again.</p>
        </div>
      )}
    </div>
  )
}
