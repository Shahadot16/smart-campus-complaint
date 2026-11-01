import { Box, Plus, Search, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import useDebounce from '../../hooks/useDebounce'
import useNow from '../../hooks/useNow'
import { adminApi, commonApi, errorMessage, fieldErrors, locationApi, opsApi } from '../../services/api'
import { ASSET_STATUS } from '../../utils/constants'
import { formatDate } from '../../utils/format'


/** All rooms (and buildings) as flat options: "Engineering Building › 2nd floor › CSE Lab 3". */
function flatten(tree) {
  const out = []
  const walk = (n, trail) => {
    const label = [...trail, n.name].join(' › ')
    if (n.type !== 'floor') out.push({ id: n._id, label })
    n.children.forEach((c) => walk(c, [...trail, n.name]))
  }
  tree.forEach((b) => walk(b, []))
  return out
}

export function AssetModal({ asset, onClose, onSaved }) {
  const editing = Boolean(asset?._id)
  const { data: cats } = useApi(() => commonApi.categories(), [])
  const { data: locs } = useApi(() => locationApi.tree(), [])
  const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
  const [form, setForm] = useState({
    code: asset?.code || '',
    name: asset?.name || '',
    type: asset?.type || '',
    category: asset?.category?._id || asset?.category || '',
    location: asset?.location?._id || asset?.location || '',
    serialNo: asset?.serialNo || '',
    purchaseDate: toDate(asset?.purchaseDate),
    warrantyUntil: toDate(asset?.warrantyUntil),
    status: asset?.status || 'operational',
    notes: asset?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    const { code, ...rest } = form
    try {
      const res = editing ? await adminApi.updateAsset(asset._id, rest) : await adminApi.createAsset({ code, ...rest })
      toast.success(res.message)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="max-w-2xl"
      title={editing ? `Edit ${asset.code}` : 'Add asset'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="asset-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Save
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Asset code" htmlFor="a-code" error={errors.code} hint={editing ? 'Codes cannot change' : 'e.g. AST-AC-405'} required>
          <input id="a-code" className="input font-mono uppercase" value={form.code} onChange={set('code')} disabled={editing} maxLength={24} />
        </Field>
        <Field label="Name" htmlFor="a-name" error={errors.name} required>
          <input id="a-name" className="input" value={form.name} onChange={set('name')} maxLength={100} />
        </Field>
        <Field label="Type" htmlFor="a-type" error={errors.type} required>
          <input id="a-type" className="input" value={form.type} onChange={set('type')} maxLength={40} placeholder="Air conditioner, Projector…" />
        </Field>
        <Field label="Complaint category" htmlFor="a-cat">
          <select id="a-cat" className="input" value={form.category} onChange={set('category')}>
            <option value="">—</option>
            {(cats || []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Location" htmlFor="a-loc">
            <select id="a-loc" className="input" value={form.location} onChange={set('location')}>
              <option value="">—</option>
              {locs &&
                flatten(locs.tree).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="Serial number" htmlFor="a-serial">
          <input id="a-serial" className="input" value={form.serialNo} onChange={set('serialNo')} maxLength={60} />
        </Field>
        <Field label="Status" htmlFor="a-status">
          <select id="a-status" className="input" value={form.status} onChange={set('status')}>
            {Object.entries(ASSET_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purchase date" htmlFor="a-pd" error={errors.purchaseDate}>
          <input id="a-pd" type="date" className="input" value={form.purchaseDate} onChange={set('purchaseDate')} />
        </Field>
        <Field label="Warranty until" htmlFor="a-wu" error={errors.warrantyUntil}>
          <input id="a-wu" type="date" className="input" value={form.warrantyUntil} onChange={set('warrantyUntil')} />
        </Field>
      </form>
    </Modal>
  )
}

export default function Assets() {
  const { user } = useAuth()
  const now = useNow()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const q = useDebounce(search)
  const { data, meta, loading, error, reload } = useApi(() => opsApi.assets({ page, search: q || undefined, status: status || undefined }), [page, q, status])
  const isAdmin = user.role === 'admin'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Assets"
        subtitle="Campus equipment and its repair history."
        actions={
          isAdmin && (
            <button className="btn-primary" onClick={() => setEditing({})}>
              <Plus className="size-4" /> Add asset
            </button>
          )
        }
      />
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input className="input pl-9" placeholder="Search name, code, type, serial…" value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} aria-label="Search assets" />
          </div>
          <select className="input sm:w-48" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(ASSET_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data.length ? (
          <EmptyState icon={Box} title="No assets found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className="table-head">Asset</th>
                    <th className="table-head">Location</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Failures (90d)</th>
                    <th className="table-head">Warranty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.map((a) => (
                    <tr key={a._id} className="hover:bg-brand-50/40">
                      <td className="table-cell">
                        <Link to={`/assets/${a._id}`} className="font-medium text-ink hover:underline">
                          {a.name}
                        </Link>
                        <p className="font-mono text-xs text-ink-muted">
                          {a.code} · {a.type}
                        </p>
                      </td>
                      <td className="table-cell text-ink-soft">{a.location?.name || '—'}</td>
                      <td className="table-cell">
                        <span className={`chip ${ASSET_STATUS[a.status].className}`}>{ASSET_STATUS[a.status].label}</span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`inline-flex items-center gap-1 tabular-nums ${a.replaceSuggested ? 'font-semibold text-red-600' : ''}`}>
                          {a.replaceSuggested && <TriangleAlert className="size-3.5" aria-label="Consider replacing" />}
                          {a.recentFailures}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-ink-soft">
                        {a.warrantyUntil ? (new Date(a.warrantyUntil).getTime() > now ? `Until ${formatDate(a.warrantyUntil)}` : 'Expired') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>
      {editing && <AssetModal asset={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}
