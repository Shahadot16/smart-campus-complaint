import {
  ArrowLeft,
  Box,
  Building2,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  Flag,
  ImagePlus,
  Lock,
  MessageSquare,
  Pencil,
  RotateCcw,
  Tag,
  User,
  UserCog,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ChatPanel from '../../components/ChatPanel'
import { PartsPanel, WorkOrdersPanel } from '../../components/RepairPanels'
import ImagePicker from '../../components/ImagePicker'
import SlaBadge from '../../components/SlaBadge'
import StarRating from '../../components/StarRating'
import { Avatar, ErrorState, Field, Modal, PageLoader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui'
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext'
import { useSocket, useSocketEvent } from '../../context/SocketContext'
import useApi from '../../hooks/useApi'
import { adminApi, commonApi, complaintApi, errorMessage, fileUrl, staffApi } from '../../services/api'
import { PRIORITY_OPTIONS, ROLE_LABELS, STATUS_ACTIONS, STATUSES } from '../../utils/constants'
import { formatDateTime, timeAgo } from '../../utils/format'

const NOTE_REQUIRED = { rejected: true, needs_information: true, resolved: true }
const NOTE_PROMPTS = {
  rejected: 'Reason for rejection (shown to the student)',
  needs_information: 'What information do you need from the student?',
  resolved: 'Resolution note — what was done?',
  in_progress: 'Note (optional)',
  under_review: 'Note (optional)',
  closed: 'Note (optional)',
}

/** Runs an API action with a toast, then refreshes the page data. */
function useAction(reload) {
  const [busy, setBusy] = useState(false)
  async function run(fn, success) {
    setBusy(true)
    try {
      const res = await fn()
      toast.success(success || res?.message || 'Done')
      await reload()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <div className="text-sm text-ink">{children}</div>
      </div>
    </div>
  )
}

function StatusModal({ target, complaint, role, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const { busy, run } = useAction(onDone)
  const reopening = target === 'in_progress' && ['resolved', 'closed'].includes(complaint.status)
  const required = NOTE_REQUIRED[target] || reopening

  async function submit(e) {
    e.preventDefault()
    if (required && !note.trim()) return toast.error('Please add a note for this change')
    const body = { status: target, note: note.trim() }
    let fn
    if (role === 'admin') fn = () => adminApi.setStatus(complaint._id, { ...body, internal })
    else if (role === 'staff') fn = () => staffApi.setStatus(complaint._id, body)
    else fn = () => complaintApi.close(complaint._id, { note: note.trim() })
    if (await run(fn)) onClose()
  }

  const label = reopening ? 'Reopen complaint' : STATUS_ACTIONS[target] || `Move to ${STATUSES[target]?.label}`
  return (
    <Modal
      open
      onClose={onClose}
      title={label}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={target === 'rejected' ? 'btn-danger' : 'btn-primary'} form="status-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Confirm
          </button>
        </>
      }
    >
      <form id="status-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          <StatusBadge status={complaint.status} /> <span className="mx-1">→</span> <StatusBadge status={target} />
        </p>
        <Field label={reopening ? 'Reason for reopening' : NOTE_PROMPTS[target] || 'Note'} htmlFor="s-note" required={required}>
          <textarea id="s-note" rows={4} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} autoFocus />
        </Field>
        {role === 'admin' && !required && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (hidden from student)
          </label>
        )}
      </form>
    </Modal>
  )
}

function AssignModal({ complaint, onClose, onDone }) {
  // Staff ranked by skill, building, workload, rating and SLA record.
  const { data: staff, loading } = useApi(() => adminApi.suggestStaff(complaint._id), [complaint._id])
  const { data: online } = useApi(() => adminApi.online(), [])
  const isOnline = (id) => online?.includes(String(id))
  const [form, setForm] = useState({ staffId: complaint.assignedStaff?._id || '', priority: complaint.priority, note: '' })
  const { busy, run } = useAction(onDone)

  async function submit(e) {
    e.preventDefault()
    if (!form.staffId) return toast.error('Please choose a staff member')
    if (await run(() => adminApi.assign(complaint._id, form))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={complaint.assignedStaff ? 'Reassign complaint' : 'Assign to staff'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="assign-form" disabled={busy || loading}>
            {busy && <Spinner className="size-4 text-white" />} Assign
          </button>
        </>
      }
    >
      {loading ? (
        <PageLoader />
      ) : (
        <form id="assign-form" onSubmit={submit} className="space-y-4">
          <Field label="Staff member" htmlFor="a-staff" required>
            {staff.length ? (
              <div className="max-h-72 space-y-2 overflow-y-auto" id="a-staff">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Sparkles className="size-3.5 text-brand-600" aria-hidden="true" /> Ranked by skill, building, workload, rating and SLA record
                </p>
                {staff.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                      form.staffId === s.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-slate-50'
                    } ${s.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <input type="radio" name="staff" value={s.id} disabled={!s.available} checked={form.staffId === s.id} onChange={() => setForm({ ...form, staffId: s.id })} />
                    <span className="relative">
                      <Avatar name={s.name} className="size-8 text-xs" />
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white ${isOnline(s.id) ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={isOnline(s.id) ? 'Online now' : 'Offline'}
                      />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">{s.name}</span>
                      <span className="block text-xs text-ink-muted">
                        {s.department} · {s.openTasks}/{s.maxOpenTasks} open
                      </span>
                      {s.reasons.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.reasons.map((r) => (
                            <span key={r} className={`chip text-[10px] ${s.available ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>
                              {r}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {s.available && (
                      <span className="flex flex-col items-center" title={Object.entries(s.breakdown).map(([k, v]) => `${k}: ${v}`).join(' · ')}>
                        <span className="text-lg font-bold text-navy-900 tabular-nums">{s.score}</span>
                        <span className="text-[10px] text-ink-muted">match</span>
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No active staff. Create a staff account first.</p>
            )}
          </Field>
          <Field label="Priority" htmlFor="a-priority">
            <select id="a-priority" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Instructions (optional)" htmlFor="a-note">
            <textarea id="a-note" rows={3} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={2000} />
          </Field>
        </form>
      )}
    </Modal>
  )
}

function EditModal({ complaint, onClose, onDone }) {
  const { data: categories } = useApi(() => commonApi.categories(), [])
  const [form, setForm] = useState({
    title: complaint.title,
    description: complaint.description,
    category: complaint.category?._id || '',
    building: complaint.location?.building || '',
    room: complaint.location?.room || '',
    priority: complaint.priority,
  })
  const [note, setNote] = useState('')
  const { busy, run } = useAction(onDone)
  const needsInfo = complaint.status === 'needs_information'
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]))
    if (needsInfo && note.trim()) body.note = note.trim()
    if (await run(() => complaintApi.update(complaint._id, body))) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="max-w-2xl"
      title="Edit complaint"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="edit-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} {needsInfo ? 'Save & resubmit' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-form" onSubmit={submit} className="space-y-4">
        {needsInfo && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            The administrator asked for more information. Saving will send the complaint back for review.
          </div>
        )}
        <Field label="Title" htmlFor="e-title" required>
          <input id="e-title" className="input" value={form.title} onChange={set('title')} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="e-cat" required>
            <select id="e-cat" className="input" value={form.category} onChange={set('category')}>
              {(categories || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="e-pri">
            <select id="e-pri" className="input" value={form.priority} onChange={set('priority')}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Building" htmlFor="e-bld" required>
            <input id="e-bld" className="input" value={form.building} onChange={set('building')} maxLength={80} />
          </Field>
          <Field label="Room / area" htmlFor="e-room">
            <input id="e-room" className="input" value={form.room} onChange={set('room')} maxLength={40} />
          </Field>
        </div>
        <Field label="Description" htmlFor="e-desc" required>
          <textarea id="e-desc" rows={5} className="input" value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        {needsInfo && (
          <Field label="Message to the administrator" htmlFor="e-note">
            <textarea id="e-note" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </Field>
        )}
      </form>
    </Modal>
  )
}

function ReopenModal({ complaint, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const { busy, run } = useAction(onDone)
  async function submit(e) {
    e.preventDefault()
    if (reason.trim().length < 5) return toast.error('Please explain why (at least 5 characters)')
    if (await run(() => complaintApi.requestReopen(complaint._id, { reason: reason.trim() }))) onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Request to reopen"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="reopen-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Send request
          </button>
        </>
      }
    >
      <form id="reopen-form" onSubmit={submit}>
        <Field label="Why isn't the issue resolved?" htmlFor="r-reason" required>
          <textarea id="r-reason" rows={4} className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} autoFocus />
        </Field>
      </form>
    </Modal>
  )
}

function FeedbackCard({ complaint, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const { busy, run } = useAction(onDone)
  return (
    <div className="card border-emerald-200 p-5">
      <h3 className="font-semibold text-navy-900">How was the resolution?</h3>
      <p className="mt-1 text-sm text-ink-soft">Your rating helps improve campus services.</p>
      <div className="mt-3">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        rows={3}
        className="input mt-3"
        placeholder="Any comments? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
      />
      <button
        className="btn-success mt-3 w-full"
        disabled={busy || !rating}
        onClick={() => run(() => complaintApi.feedback(complaint._id, { rating, comment: comment.trim() }))}
      >
        {busy && <Spinner className="size-4 text-white" />} Submit feedback
      </button>
    </div>
  )
}

function NoteForm({ complaint, role, onDone }) {
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const { busy, run } = useAction(onDone)
  async function submit(e) {
    e.preventDefault()
    if (!note.trim()) return
    const ok = await run(() => complaintApi.addNote(complaint._id, { note: note.trim(), internal: role !== 'student' && internal }), 'Comment added')
    if (ok) {
      setNote('')
      setInternal(false)
    }
  }
  return (
    <form onSubmit={submit} className="border-t border-line p-4">
      <label htmlFor="note" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="note"
        rows={2}
        className="input"
        placeholder={role === 'student' ? 'Add a comment for the team…' : 'Add a progress update or remark…'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {role !== 'student' ? (
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            <Lock className="size-3" aria-hidden="true" /> Internal (hidden from student)
          </label>
        ) : (
          <span />
        )}
        <button className="btn-primary btn-sm" disabled={busy || !note.trim()}>
          {busy && <Spinner className="size-3 text-white" />} Post
        </button>
      </div>
    </form>
  )
}

function Timeline({ history }) {
  return (
    <ol className="relative space-y-5 p-5">
      {history.map((h, i) => {
        const statusChange = h.type === 'status' && h.oldStatus !== h.newStatus
        const Icon = statusChange ? Flag : h.type === 'assignment' ? UserCog : h.type === 'priority' ? Tag : MessageSquare
        return (
          <li key={h._id} className="relative flex gap-3">
            {i < history.length - 1 && <span className="absolute top-8 bottom-[-20px] left-4 w-px bg-line" aria-hidden="true" />}
            <span
              className={`relative grid size-8 shrink-0 place-items-center rounded-full ${
                h.internal ? 'bg-slate-100 text-slate-500' : statusChange ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-ink-soft'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-ink">{h.changedBy?.name || 'System'}</span>
                {h.changedBy?.role && <span className="text-xs text-ink-muted">{ROLE_LABELS[h.changedBy.role]}</span>}
                {statusChange && (
                  <>
                    <span className="text-ink-muted">changed status to</span>
                    <StatusBadge status={h.newStatus} />
                  </>
                )}
                {h.internal && (
                  <span className="chip bg-slate-100 text-slate-600">
                    <Lock className="size-3" /> Internal
                  </span>
                )}
              </div>
              {h.note && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{h.note}</p>}
              <p className="mt-1 text-xs text-ink-muted" title={formatDateTime(h.createdAt)}>
                {timeAgo(h.createdAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Attachments({ complaint, attachments, canUpload, onDone }) {
  const [files, setFiles] = useState([])
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState(null)
  const { busy, run } = useAction(onDone)

  async function upload() {
    const fd = new FormData()
    files.forEach((f) => fd.append('images', f))
    if (await run(() => complaintApi.upload(complaint._id, fd))) {
      setFiles([])
      setAdding(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold text-navy-900">Photos ({attachments.length})</h2>
        {canUpload && !adding && (
          <button className="btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <ImagePlus className="size-4" /> Add
          </button>
        )}
      </div>
      <div className="p-5">
        {attachments.length > 0 ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {attachments.map((a) => (
              <li key={a._id}>
                <button onClick={() => setPreview(a)} className="block w-full overflow-hidden rounded-lg border border-line" aria-label={`View ${a.originalName || 'image'}`}>
                  <img src={fileUrl(a.fileUrl)} alt={a.originalName || 'Attachment'} className="aspect-square w-full object-cover transition hover:scale-105" loading="lazy" />
                </button>
                <p className="mt-1 truncate text-[11px] text-ink-muted">{a.purpose === 'resolution' ? 'Resolution' : 'Evidence'} · {a.uploadedBy?.name}</p>
              </li>
            ))}
          </ul>
        ) : (
          !adding && <p className="text-sm text-ink-muted">No photos attached.</p>
        )}
        {adding && (
          <div className={attachments.length ? 'mt-4' : ''}>
            <ImagePicker files={files} onChange={setFiles} disabled={busy} />
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn-secondary btn-sm" onClick={() => (setAdding(false), setFiles([]))}>
                Cancel
              </button>
              <button className="btn-primary btn-sm" disabled={busy || !files.length} onClick={upload}>
                {busy && <Spinner className="size-3 text-white" />} Upload {files.length || ''}
              </button>
            </div>
          </div>
        )}
      </div>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.originalName || 'Photo'} size="max-w-3xl">
        {preview && <img src={fileUrl(preview.fileUrl)} alt={preview.originalName || 'Attachment'} className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </div>
  )
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApi(() => complaintApi.get(id), [id])
  const [modal, setModal] = useState(null) // { type, target }
  const priorityAction = useAction(reload)
  const { socket, connected } = useSocket()

  // Join this complaint's live room; leave it when navigating away.
  useEffect(() => {
    if (!socket || !connected) return
    socket.emit('complaint:join', id)
    return () => socket.emit('complaint:leave', id)
  }, [socket, connected, id])

  useSocketEvent('complaint:updated', (e) => {
    if (e.id === id) reload()
  })

  if (loading && !data) return <PageLoader />
  if (error)
    return (
      <div className="card">
        <ErrorState message={error} onRetry={reload} />
        <div className="pb-8 text-center">
          <Link to={HOME_BY_ROLE[user.role]} className="text-sm text-brand-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )

  const { complaint: c, history, attachments, feedback, permissions: p } = data
  const role = user.role
  const statusTargets = role === 'student' ? [] : p.nextStatuses
  const close = () => setModal(null)

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm mb-4 -ml-2">
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-navy-800">{c.trackingCode}</span>
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            <SlaBadge complaint={c} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900">{c.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Submitted {formatDateTime(c.createdAt)} · updated {timeAgo(c.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.canEdit && (
            <button className="btn-secondary" onClick={() => setModal({ type: 'edit' })}>
              <Pencil className="size-4" /> {c.status === 'needs_information' ? 'Provide information' : 'Edit'}
            </button>
          )}
          {p.canAssign && (
            <button className="btn-primary" onClick={() => setModal({ type: 'assign' })}>
              <UserCog className="size-4" /> {c.assignedStaff ? 'Reassign' : 'Assign staff'}
            </button>
          )}
          {statusTargets.map((s) => {
            const reopening = s === 'in_progress' && ['resolved', 'closed'].includes(c.status)
            const cls = s === 'rejected' ? 'btn-secondary text-red-600' : s === 'resolved' ? 'btn-success' : 'btn-secondary'
            return (
              <button key={s} className={cls} onClick={() => setModal({ type: 'status', target: s })}>
                {reopening ? (
                  <>
                    <RotateCcw className="size-4" /> Reopen
                  </>
                ) : (
                  STATUS_ACTIONS[s] || STATUSES[s]?.label
                )}
              </button>
            )
          })}
          {p.canClose && (
            <button className="btn-success" onClick={() => setModal({ type: 'status', target: 'closed' })}>
              <CheckCircle2 className="size-4" /> Confirm resolved
            </button>
          )}
          {p.canRequestReopen && (
            <button className="btn-secondary" onClick={() => setModal({ type: 'reopen' })}>
              <RotateCcw className="size-4" /> Not fixed? Request reopen
            </button>
          )}
        </div>
      </div>

      {c.status === 'needs_information' && role === 'student' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The administrator needs more information. Check the latest update below, then use <strong>Provide information</strong>.
        </div>
      )}
      {c.reopenRequest?.requested && (
        <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          <strong>Reopen requested</strong> {timeAgo(c.reopenRequest.requestedAt)}: {c.reopenRequest.reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-semibold text-navy-900">Description</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink">{c.description}</p>
            {c.resolutionNote && (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-800 uppercase">Resolution</p>
                <p className="mt-1 text-sm whitespace-pre-line text-emerald-900">{c.resolutionNote}</p>
              </div>
            )}
            {c.rejectionReason && c.status === 'rejected' && (
              <div className="mt-4 rounded-lg bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800 uppercase">Rejection reason</p>
                <p className="mt-1 text-sm whitespace-pre-line text-red-900">{c.rejectionReason}</p>
              </div>
            )}
          </div>

          <Attachments complaint={c} attachments={attachments} canUpload={p.canUpload} onDone={reload} />

          {role !== 'student' && <WorkOrdersPanel complaintId={c._id} canRaise={p.canRaiseWorkOrder} />}
          {role !== 'student' && <PartsPanel complaintId={c._id} canUse={p.canUseParts} onChanged={reload} />}

          <div className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 font-semibold text-navy-900">Activity</h2>
            <Timeline history={history} />
            {p.canAddNote && <NoteForm complaint={c} role={role} onDone={reload} />}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card divide-y divide-line px-5 py-2">
            <InfoRow icon={Tag} label="Category">
              {c.category?.name || '—'}
            </InfoRow>
            {c.asset && (
              <InfoRow icon={Box} label="Asset">
                {['admin', 'staff', 'dept_head'].includes(role) ? (
                  <Link to={`/assets/${c.asset._id}`} className="text-brand-700 hover:underline">
                    {c.asset.name}
                  </Link>
                ) : (
                  c.asset.name
                )}
                <span className="block font-mono text-xs text-ink-muted">{c.asset.code}</span>
              </InfoRow>
            )}
            <InfoRow icon={Building2} label="Location">
              {c.location?.building}
              {c.location?.room ? `, ${c.location.room}` : ''}
            </InfoRow>
            <InfoRow icon={User} label="Submitted by">
              {c.student?.name}
              {c.student?.studentId && <span className="text-ink-muted"> · {c.student.studentId}</span>}
              {c.student?.email && <span className="block text-xs text-ink-muted">{c.student.email}</span>}
              {c.student?.phone && <span className="block text-xs text-ink-muted">{c.student.phone}</span>}
            </InfoRow>
            <InfoRow icon={Wrench} label="Assigned to">
              {c.assignedStaff ? (
                <>
                  {c.assignedStaff.name}
                  {c.assignedStaff.department && <span className="text-ink-muted"> · {c.assignedStaff.department}</span>}
                  {c.assignedStaff.phone && <span className="block text-xs text-ink-muted">{c.assignedStaff.phone}</span>}
                </>
              ) : (
                <span className="text-ink-muted italic">Not assigned yet</span>
              )}
            </InfoRow>
            <InfoRow icon={Flag} label="Priority">
              {p.canChangePriority ? (
                <select
                  className="input mt-1 py-1"
                  value={c.priority}
                  disabled={priorityAction.busy}
                  onChange={(e) => priorityAction.run(() => adminApi.setPriority(c._id, { priority: e.target.value }))}
                  aria-label="Change priority"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <PriorityBadge priority={c.priority} />
              )}
            </InfoRow>
            {c.sla?.resolveDueAt && (
              <InfoRow icon={CalendarDays} label="SLA deadlines">
                <span className="block">Respond by {formatDateTime(c.sla.responseDueAt)}</span>
                <span className="block">Resolve by {formatDateTime(c.sla.resolveDueAt)}</span>
                {(c.sla.responseBreached || c.sla.resolveBreached) && (
                  <span className="mt-1 block text-xs font-medium text-red-600">
                    {c.sla.resolveBreached ? 'Resolution deadline missed' : 'Response deadline missed'}
                    {c.sla.escalationLevel >= 3 ? ' · escalated' : ''}
                  </span>
                )}
              </InfoRow>
            )}
            {(c.resolvedAt || c.closedAt) && (
              <InfoRow icon={CalendarDays} label={c.closedAt ? 'Closed' : 'Resolved'}>
                {formatDateTime(c.closedAt || c.resolvedAt)}
              </InfoRow>
            )}
          </div>

          {c.status !== 'rejected' && (role !== 'student' || c.assignedStaff) && <ChatPanel complaintId={c._id} />}
          {p.canFeedback && <FeedbackCard complaint={c} onDone={reload} />}
          {feedback && (
            <div className="card p-5">
              <h3 className="font-semibold text-navy-900">Student feedback</h3>
              <div className="mt-2">
                <StarRating value={feedback.rating} readOnly size="size-5" />
              </div>
              {feedback.comment && <p className="mt-2 text-sm text-ink-soft">“{feedback.comment}”</p>}
              <p className="mt-2 text-xs text-ink-muted">{timeAgo(feedback.createdAt)}</p>
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'status' && <StatusModal target={modal.target} complaint={c} role={role} onClose={close} onDone={reload} />}
      {modal?.type === 'assign' && <AssignModal complaint={c} onClose={close} onDone={reload} />}
      {modal?.type === 'edit' && <EditModal complaint={c} onClose={close} onDone={reload} />}
      {modal?.type === 'reopen' && <ReopenModal complaint={c} onClose={close} onDone={reload} />}
    </div>
  )
}
