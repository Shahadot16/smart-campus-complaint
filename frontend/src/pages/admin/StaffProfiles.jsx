import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Avatar, EmptyState, ErrorState, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, commonApi, errorMessage, locationApi } from '../../services/api'

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

function Chips({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o._id)
        return (
          <button
            key={o._id}
            type="button"
            onClick={() => onToggle(o._id)}
            aria-pressed={on}
            className={`chip cursor-pointer ring-1 ring-inset transition ${on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-soft ring-line hover:ring-brand-200'}`}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}

function StaffCard({ staff, categories, buildings }) {
  const p = staff.staffProfile
  const [form, setForm] = useState({
    skills: (p.skills || []).map(String),
    zones: (p.zones || []).map(String),
    maxOpenTasks: p.maxOpenTasks || 6,
    leaves: (p.leaves || []).map((l) => ({ from: day(l.from), to: day(l.to), reason: l.reason || '' })),
  })
  const [busy, setBusy] = useState(false)
  const toggle = (key) => (id) => setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }))
  const setLeave = (i, k, v) => setForm((f) => ({ ...f, leaves: f.leaves.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }))

  async function save() {
    setBusy(true)
    try {
      const res = await adminApi.updateStaffProfile(staff.id, { ...form, maxOpenTasks: Number(form.maxOpenTasks), leaves: form.leaves.filter((l) => l.from && l.to) })
      toast.success(res.message)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={staff.name} />
        <div className="flex-1">
          <p className="font-semibold text-navy-900">{staff.name}</p>
          <p className="text-xs text-ink-muted">
            {staff.department} · {staff.openTasks} open task{staff.openTasks === 1 ? '' : 's'}
          </p>
        </div>
        <label className="text-right text-xs text-ink-soft">
          Max open tasks
          <input type="number" min="1" max="50" className="input mt-1 w-20 py-1" value={form.maxOpenTasks} onChange={(e) => setForm({ ...form, maxOpenTasks: e.target.value })} />
        </label>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Skills (categories)</p>
        <Chips options={categories} selected={form.skills} onToggle={toggle('skills')} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Covers buildings</p>
        <Chips options={buildings} selected={form.zones} onToggle={toggle('zones')} />
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
          <CalendarOff className="size-3.5" /> Leave
        </p>
        {form.leaves.map((l, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <input type="date" className="input w-auto py-1" value={l.from} onChange={(e) => setLeave(i, 'from', e.target.value)} aria-label="Leave from" />
            <span className="text-xs text-ink-muted">to</span>
            <input type="date" className="input w-auto py-1" value={l.to} onChange={(e) => setLeave(i, 'to', e.target.value)} aria-label="Leave to" />
            <input className="input flex-1 py-1" placeholder="Reason" value={l.reason} onChange={(e) => setLeave(i, 'reason', e.target.value)} maxLength={120} />
            <button className="btn-ghost btn-sm px-2" onClick={() => setForm((f) => ({ ...f, leaves: f.leaves.filter((_, j) => j !== i) }))} aria-label="Remove leave">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button className="btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, leaves: [...f.leaves, { from: '', to: '', reason: '' }] }))}>
          <Plus className="size-3.5" /> Add leave
        </button>
      </div>
      <div className="flex justify-end border-t border-line pt-3">
        <button className="btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? <Spinner className="size-3 text-white" /> : <Save className="size-3.5" />} Save profile
        </button>
      </div>
    </div>
  )
}

export default function StaffProfiles() {
  const staff = useApi(() => adminApi.staff(), [])
  const cats = useApi(() => commonApi.categories(), [])
  const locs = useApi(() => locationApi.tree(), [])

  if (staff.loading || cats.loading || locs.loading) return <PageLoader />
  if (staff.error) return <ErrorState message={staff.error} onRetry={staff.reload} />

  return (
    <div className="animate-fade-in">
      <PageHeader title="Staff & skills" subtitle="Smart assignment matches complaints to staff by skill, building, workload, rating and SLA record." />
      {staff.data.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {staff.data.map((s) => (
            <StaffCard key={s.id} staff={s} categories={cats.data} buildings={locs.data.tree} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState title="No active staff" message="Create staff accounts under Users first." />
        </div>
      )}
    </div>
  )
}
