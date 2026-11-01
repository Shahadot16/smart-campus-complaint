import { CheckCircle2, Clock, Package, Plus, Receipt, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import useApi from '../hooks/useApi'
import { errorMessage, opsApi } from '../services/api'
import { taka, timeAgo } from '../utils/format'
import { Field, Modal, Spinner } from './ui'

const WO_STATUS = {
  pending: { label: 'Awaiting approval', className: 'bg-amber-50 text-amber-800', icon: Clock },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700', icon: XCircle },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
}
const STEP = { dept_head: 'Department head', admin: 'Administrator' }

/** Spare parts used on a complaint; the assigned staff member can add more. */
export function PartsPanel({ complaintId, canUse, onChanged }) {
  const { data, reload } = useApi(() => opsApi.partsUsed(complaintId), [complaintId])
  const [adding, setAdding] = useState(false)
  const { data: parts } = useApi(() => (adding ? opsApi.parts() : Promise.resolve({ data: null })), [adding])
  const [form, setForm] = useState({ part: '', quantity: 1 })
  const [busy, setBusy] = useState(false)
  const chosen = parts?.find((p) => p._id === form.part)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await opsApi.useParts(complaintId, { part: form.part, quantity: Number(form.quantity) })
      toast.success(res.message)
      setAdding(false)
      setForm({ part: '', quantity: 1 })
      reload()
      onChanged?.()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!canUse && !data?.items.length) return null
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-navy-900">
          <Package className="size-4 text-brand-600" aria-hidden="true" /> Parts used
        </h2>
        <span className="text-sm font-semibold text-navy-900">{taka(data?.total)}</span>
      </div>
      {data?.items.length ? (
        <ul className="divide-y divide-line">
          {data.items.map((m) => (
            <li key={m._id} className="flex items-center justify-between px-5 py-2 text-sm">
              <span>
                {-m.quantity} {m.part?.unit} × {m.part?.name}
                <span className="block text-xs text-ink-muted">
                  {m.by?.name} · {timeAgo(m.createdAt)}
                </span>
              </span>
              <span className="text-ink-soft tabular-nums">{taka(-m.quantity * m.unitCost)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-3 text-sm text-ink-muted">No parts recorded yet.</p>
      )}
      {canUse && (
        <div className="border-t border-line p-3">
          {adding ? (
            <form onSubmit={submit} className="space-y-2">
              <select className="input" value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })} aria-label="Part" required>
                <option value="">Choose a part…</option>
                {(parts || []).map((p) => (
                  <option key={p._id} value={p._id} disabled={p.quantity < 1}>
                    {p.name} — {p.quantity} {p.unit} left · {taka(p.unitCost)}/{p.unit}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input type="number" min="1" max={chosen?.quantity || 1000} className="input w-24" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} aria-label="Quantity" />
                <span className="flex-1 self-center text-xs text-ink-muted">{chosen ? `= ${taka(chosen.unitCost * Number(form.quantity || 0))}` : ''}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button className="btn-primary btn-sm" disabled={busy || !form.part}>
                  {busy && <Spinner className="size-3 text-white" />} Record
                </button>
              </div>
            </form>
          ) : (
            <button className="btn-ghost btn-sm w-full" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Record parts used
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DecisionModal({ wo, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  async function decide(decision) {
    setBusy(decision)
    try {
      const res = await opsApi.decide(wo._id, { decision, note: note.trim() })
      toast.success(res.message)
      onDone()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Review work order"
      footer={
        <>
          <button className="btn-secondary text-red-600" onClick={() => decide('rejected')} disabled={Boolean(busy)}>
            {busy === 'rejected' && <Spinner className="size-4" />} Reject
          </button>
          <button className="btn-success" onClick={() => decide('approved')} disabled={Boolean(busy)}>
            {busy === 'approved' && <Spinner className="size-4 text-white" />} Approve
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-2xl font-bold text-navy-900">{taka(wo.estimatedCost)}</p>
        <p className="text-ink">{wo.description}</p>
        <p className="text-xs text-ink-muted">
          Requested by {wo.createdBy?.name} · {timeAgo(wo.createdAt)}
        </p>
        <Field label="Note (required when rejecting)" htmlFor="wo-note">
          <textarea id="wo-note" rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}

/** One work order with its approval chain. */
export function WorkOrderCard({ wo, onDone, showComplaint }) {
  const { user } = useAuth()
  const [reviewing, setReviewing] = useState(false)
  const st = WO_STATUS[wo.status]
  const next = wo.status === 'pending' ? wo.requiredApprovals[wo.approvals.length] : null
  const mine = next && next === user.role && (next === 'admin' || wo.department === user.department)

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showComplaint && wo.complaint && (
            <Link to={`/complaints/${wo.complaint._id}`} className="font-mono text-xs text-navy-800 hover:underline">
              {wo.complaint.trackingCode} · {wo.complaint.title}
            </Link>
          )}
          <p className="font-medium text-ink">{wo.description}</p>
          <p className="text-xs text-ink-muted">
            {wo.createdBy?.name} · {timeAgo(wo.createdAt)} {wo.department && `· ${wo.department}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-navy-900">{taka(wo.estimatedCost)}</p>
          <span className={`chip ${st.className}`}>
            <st.icon className="size-3" /> {st.label}
          </span>
        </div>
      </div>

      {wo.requiredApprovals.length > 0 && (
        <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {wo.requiredApprovals.map((role, i) => {
            const a = wo.approvals[i]
            const tone = a ? (a.decision === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200') : i === wo.approvals.length && wo.status === 'pending' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-50 text-slate-500 ring-slate-200'
            return (
              <li key={role} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink-muted">→</span>}
                <span className={`chip ring-1 ring-inset ${tone}`} title={a?.note || ''}>
                  {STEP[role]}
                  {a ? `: ${a.decision} by ${a.by?.name || '—'}` : i === wo.approvals.length && wo.status === 'pending' ? ': waiting' : ''}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {wo.approvals.some((a) => a.note) && <p className="mt-2 text-xs text-ink-soft italic">“{wo.approvals.filter((a) => a.note).at(-1).note}”</p>}
      {mine && (
        <button className="btn-primary btn-sm mt-3" onClick={() => setReviewing(true)}>
          <Receipt className="size-3.5" /> Review & decide
        </button>
      )}
      {reviewing && <DecisionModal wo={wo} onClose={() => setReviewing(false)} onDone={onDone} />}
    </div>
  )
}

/** Work orders on a complaint, with a form to raise a new one. */
export function WorkOrdersPanel({ complaintId, canRaise }) {
  const { data, reload } = useApi(() => opsApi.workOrders(complaintId), [complaintId])
  const { data: limits } = useApi(() => (canRaise ? opsApi.limits() : Promise.resolve({ data: null })), [canRaise])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ description: '', estimatedCost: '' })
  const [busy, setBusy] = useState(false)
  const pending = data?.some((w) => w.status === 'pending')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await opsApi.raiseWorkOrder(complaintId, { description: form.description.trim(), estimatedCost: Number(form.estimatedCost) })
      toast.success(res.message)
      setOpen(false)
      setForm({ description: '', estimatedCost: '' })
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!canRaise && !data?.length) return null
  const cost = Number(form.estimatedCost || 0)
  const needs = limits ? (cost > limits.admin ? 'department head → administrator' : cost > limits.deptHead ? 'department head' : 'none (auto-approved)') : ''

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-navy-900">
          <Receipt className="size-4 text-brand-600" aria-hidden="true" /> Work orders
        </h2>
        {canRaise && !pending && (
          <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Raise
          </button>
        )}
      </div>
      <div className="space-y-3 p-4">
        {data?.length ? data.map((w) => <WorkOrderCard key={w._id} wo={w} onDone={reload} />) : <p className="text-sm text-ink-muted">No costed work orders.</p>}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Raise a work order"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" form="wo-form" disabled={busy}>
              {busy && <Spinner className="size-4 text-white" />} Submit
            </button>
          </>
        }
      >
        <form id="wo-form" onSubmit={submit} className="space-y-4">
          <Field label="What needs to be done / bought?" htmlFor="wo-desc" required>
            <textarea id="wo-desc" rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          </Field>
          <Field label="Estimated cost (BDT)" htmlFor="wo-cost" hint={limits && `Approval needed: ${needs}. Limits: head > ${taka(limits.deptHead)}, admin > ${taka(limits.admin)}`} required>
            <input id="wo-cost" type="number" min="0" className="input" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
