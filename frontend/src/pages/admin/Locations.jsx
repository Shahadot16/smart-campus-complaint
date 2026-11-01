import { Building2, ChevronDown, ChevronRight, DoorOpen, Layers, Pencil, Plus, Power, QrCode } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, errorMessage, fieldErrors, locationApi } from '../../services/api'

const TYPE_ICON = { building: Building2, floor: Layers, room: DoorOpen }
const CHILD_TYPE = { building: 'floor', floor: 'room' }

function LocationModal({ initial, onClose, onSaved }) {
  const editing = Boolean(initial._id)
  const [form, setForm] = useState({
    name: initial.name || '',
    code: initial.code || '',
    department: initial.department || '',
    lat: initial.geo?.lat ?? '',
    lng: initial.geo?.lng ?? '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    const body = { name: form.name.trim(), code: form.code.trim(), department: form.department.trim() }
    if (initial.type === 'building' && form.lat !== '' && form.lng !== '') Object.assign(body, { lat: Number(form.lat), lng: Number(form.lng) })
    try {
      const res = editing
        ? await adminApi.updateLocation(initial._id, body)
        : await adminApi.createLocation({ ...body, type: initial.type, parent: initial.parent })
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
      title={`${editing ? 'Edit' : 'New'} ${initial.type}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="loc-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Save
          </button>
        </>
      }
    >
      <form id="loc-form" onSubmit={submit} className="space-y-4" noValidate>
        {initial.parentName && <p className="text-sm text-ink-soft">Inside: <strong>{initial.parentName}</strong></p>}
        <Field label="Name" htmlFor="l-name" error={errors.name} required>
          <input id="l-name" className="input" value={form.name} onChange={set('name')} maxLength={80} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="QR code" htmlFor="l-code" error={errors.code} hint="Short unique code, e.g. ENG-301" required>
            <input id="l-code" className="input font-mono uppercase" value={form.code} onChange={set('code')} maxLength={24} />
          </Field>
          <Field label="Department" htmlFor="l-dept" error={errors.department} hint="Optional, e.g. CSE">
            <input id="l-dept" className="input uppercase" value={form.department} onChange={set('department')} maxLength={10} />
          </Field>
        </div>
        {initial.type === 'building' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" htmlFor="l-lat" error={errors.lat} hint="For the campus map">
              <input id="l-lat" type="number" step="0.000001" className="input" value={form.lat} onChange={set('lat')} />
            </Field>
            <Field label="Longitude" htmlFor="l-lng" error={errors.lng}>
              <input id="l-lng" type="number" step="0.000001" className="input" value={form.lng} onChange={set('lng')} />
            </Field>
          </div>
        )}
      </form>
    </Modal>
  )
}

function Node({ node, depth, onAdd, onEdit, onToggle }) {
  const [open, setOpen] = useState(depth === 0)
  const Icon = TYPE_ICON[node.type]
  const childType = CHILD_TYPE[node.type]
  return (
    <li>
      <div className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 ${node.isActive ? '' : 'opacity-50'}`} style={{ paddingLeft: depth * 22 + 8 }}>
        {node.children.length ? (
          <button onClick={() => setOpen(!open)} className="text-ink-muted" aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Icon className={`size-4 ${node.type === 'building' ? 'text-brand-600' : 'text-ink-muted'}`} aria-hidden="true" />
        <span className={`flex-1 text-sm ${node.type === 'building' ? 'font-semibold text-navy-900' : 'text-ink'}`}>
          {node.name}
          {!node.isActive && <span className="ml-2 text-xs text-ink-muted">(inactive)</span>}
        </span>
        <span className="font-mono text-[11px] text-ink-muted">{node.code}</span>
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {childType && node.isActive && (
            <button className="btn-ghost btn-sm px-2" onClick={() => onAdd(childType, node)} title={`Add ${childType}`}>
              <Plus className="size-3.5" />
            </button>
          )}
          <button className="btn-ghost btn-sm px-2" onClick={() => onEdit(node)} title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button className="btn-ghost btn-sm px-2" onClick={() => onToggle(node)} title={node.isActive ? 'Deactivate' : 'Activate'}>
            <Power className="size-3.5" />
          </button>
        </div>
      </div>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c._id} node={c} depth={depth + 1} onAdd={onAdd} onEdit={onEdit} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function Locations() {
  const { data, loading, error, reload } = useApi(() => locationApi.tree({ all: 'true' }), [])
  const [modal, setModal] = useState(null)

  async function toggle(node) {
    try {
      await adminApi.updateLocation(node._id, { isActive: !node.isActive })
      toast.success(node.isActive ? `${node.name} deactivated` : `${node.name} activated`)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Campus locations"
        subtitle="Buildings, floors and rooms. Each has a QR code students can scan to report an issue right there."
        actions={
          <button className="btn-primary" onClick={() => setModal({ type: 'building' })}>
            <Plus className="size-4" /> Add building
          </button>
        }
      />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.tree.length ? (
        <div className="card">
          <EmptyState icon={Building2} title="No locations yet" message="Add the first building to start." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.tree.map((b) => (
            <div key={b._id} className="card p-3">
              <ul>
                <Node
                  node={b}
                  depth={0}
                  onAdd={(type, parent) => setModal({ type, parent: parent._id, parentName: parent.name })}
                  onEdit={(node) => setModal(node)}
                  onToggle={toggle}
                />
              </ul>
              <div className="mt-2 flex justify-end border-t border-line pt-2">
                <Link to={`/admin/locations/${b._id}/qr`} className="btn-secondary btn-sm">
                  <QrCode className="size-3.5" /> Print QR stickers
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <LocationModal initial={modal} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  )
}
